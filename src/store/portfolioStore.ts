import { create } from 'zustand';
import type { Project, SiteConfig, Skill, Experience, Certificate } from '../types';
import { defaultProjects, defaultSiteConfig, defaultSkills, defaultExperiences, defaultCertificates } from '../data/defaultData';
import { db, auth } from '../config/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, getDoc, writeBatch } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

// ─── Portfolio Store ─────────────────────────────────────────────────────────

interface PortfolioStore {
    projects: Project[];
    siteConfig: SiteConfig;
    skills: Skill[];
    experiences: Experience[];
    certificates: Certificate[];
    isAdminLoggedIn: boolean;
    adminLoginError: string;
    isInitialized: boolean;
    projectsLoaded: boolean;
    configLoaded: boolean;
    authInitialized: boolean;

    // Initialization
    initFirebase: () => void;

    // Project actions
    addProject: (project: Project) => Promise<void>;
    updateProject: (id: string, project: Partial<Project>) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    reorderProjects: (projects: Project[]) => Promise<void>;

    // Config actions
    updateSiteConfig: (config: Partial<SiteConfig>) => Promise<void>;

    // Skill actions
    addSkill: (skill: Skill) => Promise<void>;
    updateSkill: (id: string, skill: Partial<Skill>) => Promise<void>;
    deleteSkill: (id: string) => Promise<void>;

    // Experience actions
    addExperience: (exp: Experience) => Promise<void>;
    updateExperience: (id: string, exp: Partial<Experience>) => Promise<void>;
    deleteExperience: (id: string) => Promise<void>;

    // Certificate actions
    addCertificate: (cert: Certificate) => Promise<void>;
    updateCertificate: (id: string, cert: Partial<Certificate>) => Promise<void>;
    deleteCertificate: (id: string) => Promise<void>;
    reorderCertificates: (certs: Certificate[]) => Promise<void>;

    // Admin actions
    loginAdmin: (email: string, password: string) => Promise<boolean>;
    logoutAdmin: () => Promise<void>;

    // Reset (Not fully supported when syncing with FB, but we can set the state)
    resetToDefaults: () => Promise<void>;
}

// Helper to catch errors if Firebase is not properly configured yet
const safeFbCall = async (callback: () => Promise<void>) => {
    try {
        await callback();
    } catch (error) {
        console.error('Firebase operation failed:', error);
        throw error;
    }
};

const EMPTY_SITE_CONFIG: SiteConfig = {
    name: '',
    tagline: '',
    heroTitle: '',
    bio: '',
    aboutTitle: '',
    aboutMe: '',
    email: '',
    phone: '',
    github: '',
    linkedin: '',
    twitter: '',
    instagram: '',
    resumeUrl: '',
    availableForWork: false,
    location: '',
    profileImage: '',
    accentColor: '#6366f1',
    theme: 'dark',
};

export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
    projects: [],
    siteConfig: EMPTY_SITE_CONFIG,
    skills: [],
    experiences: [],
    certificates: [],
    isAdminLoggedIn: false,
    adminLoginError: '',
    isInitialized: false,
    projectsLoaded: false,
    configLoaded: false,
    authInitialized: false,

    initFirebase: () => {
        if (get().isInitialized) return;
        set({ isInitialized: true });

        try {
            // Listen to Auth State
            onAuthStateChanged(auth, async (user) => {
                if (!user) {
                    set({ isAdminLoggedIn: false, authInitialized: true });
                    return;
                }

                try {
                    const adminRecord = await getDoc(doc(db, 'admins', user.uid));
                    set({
                        isAdminLoggedIn: adminRecord.exists() && adminRecord.data().enabled === true,
                        authInitialized: true,
                    });
                } catch (error) {
                    console.error('Unable to verify administrator access:', error);
                    set({ isAdminLoggedIn: false, authInitialized: true });
                }
            });

            // Listen to SiteConfig
            onSnapshot(doc(db, 'config', 'siteConfig'), (snapshot) => {
                if (snapshot.exists()) {
                    set({ siteConfig: snapshot.data() as SiteConfig, configLoaded: true });
                } else {
                    // Use safe, portfolio-specific defaults locally. Public visitors must
                    // not need write permission merely to initialize the site.
                    set({ siteConfig: defaultSiteConfig, configLoaded: true });
                }
            }, (err) => {
                console.warn('Firebase config error (are credentials/rules set?):', err);
                set({ configLoaded: true });
            });

            // Always mirror the server snapshot, including an empty collection.
            // Never auto-seed content: deleting the final item must remain deleted.
            onSnapshot(collection(db, 'projects'), (snapshot) => {
                const projects = snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as Project);
                set({ projects, projectsLoaded: true });
            }, (err) => {
                console.warn('Firebase projects error:', err);
                set({ projectsLoaded: true }); // Prevent UI from being stuck
            });

            // Empty snapshots are valid data: keep the admin and public UI in sync.
            onSnapshot(collection(db, 'skills'), (snapshot) => {
                const skills = snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as Skill);
                set({ skills });
            }, (err) => console.warn('Firebase skills error:', err));

            onSnapshot(collection(db, 'experiences'), (snapshot) => {
                const experiences = snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as Experience);
                set({ experiences });
            }, (err) => console.warn('Firebase experiences error:', err));

            // An empty collection must clear stale certificates from Zustand.
            // Do not recreate template records when the final certificate is deleted.
            onSnapshot(collection(db, 'certificates'), (snapshot) => {
                const certificates = snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as Certificate);
                set({ certificates });
            }, (err) => console.warn('Firebase certificates error:', err));
        } catch (e) {
            console.error('Error initializing Firebase listeners:', e);
        }
    },

    // ── Project actions ──────────────────────────────────────────
    addProject: async (project) => {
        await safeFbCall(() => setDoc(doc(db, 'projects', project.id), project));
    },

    updateProject: async (id, updatedProject) => {
        await safeFbCall(() => setDoc(doc(db, 'projects', id), updatedProject, { merge: true }));
    },

    deleteProject: async (id) => {
        await safeFbCall(() => deleteDoc(doc(db, 'projects', id)));
    },

    reorderProjects: async (projects) => {
        // Let the snapshot handle the reorder to maintain a single source of truth
        await safeFbCall(async () => {
            for (const p of projects) {
                await setDoc(doc(db, 'projects', p.id), { order: p.order }, { merge: true });
            }
        });
    },

    // ── Config actions ───────────────────────────────────────────
    updateSiteConfig: async (config) => {
        await safeFbCall(() => setDoc(doc(db, 'config', 'siteConfig'), config, { merge: true }));
    },

    // ── Skill actions ────────────────────────────────────────────
    addSkill: async (skill) => {
        await safeFbCall(() => setDoc(doc(db, 'skills', skill.id), skill));
    },

    updateSkill: async (id, updatedSkill) => {
        await safeFbCall(() => setDoc(doc(db, 'skills', id), updatedSkill, { merge: true }));
    },

    deleteSkill: async (id) => {
        await safeFbCall(() => deleteDoc(doc(db, 'skills', id)));
    },

    // ── Experience actions ───────────────────────────────────────
    addExperience: async (exp) => {
        await safeFbCall(() => setDoc(doc(db, 'experiences', exp.id), exp));
    },

    updateExperience: async (id, updatedExp) => {
        await safeFbCall(() => setDoc(doc(db, 'experiences', id), updatedExp, { merge: true }));
    },

    deleteExperience: async (id) => {
        await safeFbCall(() => deleteDoc(doc(db, 'experiences', id)));
    },

    // ── Certificate actions ──────────────────────────────────────
    addCertificate: async (cert) => {
        await safeFbCall(() => setDoc(doc(db, 'certificates', cert.id), cert));
    },

    updateCertificate: async (id, updatedCert) => {
        await safeFbCall(() => setDoc(doc(db, 'certificates', id), updatedCert, { merge: true }));
    },

    deleteCertificate: async (id) => {
        await safeFbCall(() => deleteDoc(doc(db, 'certificates', id)));
    },

    reorderCertificates: async (certs) => {
        await safeFbCall(async () => {
            for (const c of certs) {
                await setDoc(doc(db, 'certificates', c.id), { order: c.order }, { merge: true });
            }
        });
    },

    // ── Admin actions ────────────────────────────────────────────
    loginAdmin: async (email, password) => {
        set({ adminLoginError: '' });
        try {
            const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
            // Verify this user against the project's explicit Firestore admin allowlist.
            // No custom claims or Firebase Admin SDK setup are required.
            const adminRecord = await getDoc(doc(db, 'admins', credential.user.uid));
            if (!adminRecord.exists() || adminRecord.data().enabled !== true) {
                await signOut(auth);
                set({
                    isAdminLoggedIn: false,
                    adminLoginError: "Your Firebase account is valid, but it is not on this portfolio's admin allowlist. Ask the project owner to add your UID to the admins collection and set enabled to true.",
                });
                return false;
            }
            set({ isAdminLoggedIn: true, adminLoginError: '' });
            return true;
        } catch (error) {
            console.error('Firebase Auth error:', error);
            const code = (error as { code?: string })?.code;
            const messages: Record<string, string> = {
                'auth/invalid-credential': 'The email or password is incorrect. Check the credentials in Firebase Authentication.',
                'auth/user-not-found': 'No Firebase Authentication user exists with this email address.',
                'auth/wrong-password': 'The password is incorrect. Try again or reset the password in Firebase Authentication.',
                'auth/invalid-email': 'Enter a valid email address.',
                'auth/too-many-requests': 'Too many login attempts. Wait a while before trying again.',
                'auth/network-request-failed': 'A network error prevented Firebase Authentication from completing the login. Check your connection and try again.',
                'auth/operation-not-allowed': 'Email/password sign-in is disabled for this Firebase project. Enable it under Authentication → Sign-in method.',
            };
            set({
                isAdminLoggedIn: false,
                adminLoginError: messages[code || ''] || 'Firebase could not complete sign-in. Check the browser console and Firebase Authentication settings.',
            });
            return false;
        }
    },

    logoutAdmin: async () => {
        try {
            await signOut(auth);
            set({ isAdminLoggedIn: false });
        } catch (e) {
            console.error('Firebase Logout error:', e);
        }
    },

    // ── Reset ────────────────────────────────────────────────────
    resetToDefaults: async () => {
        await safeFbCall(async () => {
            const collections = ['projects', 'skills', 'experiences', 'certificates'];
            const snapshots = await Promise.all(collections.map((name) => getDocs(collection(db, name))));
            const documentRefs = snapshots.flatMap((snapshot) => snapshot.docs.map((item) => item.ref));

            // Keep each delete batch below Firestore's 500-write limit.
            for (let offset = 0; offset < documentRefs.length; offset += 450) {
                const batch = writeBatch(db);
                documentRefs.slice(offset, offset + 450).forEach((ref) => batch.delete(ref));
                await batch.commit();
            }

            await setDoc(doc(db, 'config', 'siteConfig'), defaultSiteConfig);
            await Promise.all([
                ...defaultProjects.map((item) => setDoc(doc(db, 'projects', item.id), item)),
                ...defaultSkills.map((item) => setDoc(doc(db, 'skills', item.id), item)),
                ...defaultExperiences.map((item) => setDoc(doc(db, 'experiences', item.id), item)),
                ...defaultCertificates.map((item) => setDoc(doc(db, 'certificates', item.id), item)),
            ]);
        });

        set({
            projects: defaultProjects,
            siteConfig: defaultSiteConfig,
            skills: defaultSkills,
            experiences: defaultExperiences,
            certificates: defaultCertificates,
        });
    },
}));
