import { create } from 'zustand';
import type { Project, SiteConfig, Skill, Experience, Certificate } from '../types';
import { defaultProjects, defaultSiteConfig, defaultSkills, defaultExperiences, defaultCertificates } from '../data/defaultData';
import { db, auth } from '../config/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs, writeBatch } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, getIdTokenResult } from 'firebase/auth';

// ─── Portfolio Store ─────────────────────────────────────────────────────────

interface PortfolioStore {
    projects: Project[];
    siteConfig: SiteConfig;
    skills: Skill[];
    experiences: Experience[];
    certificates: Certificate[];
    isAdminLoggedIn: boolean;
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
                    const token = await getIdTokenResult(user);
                    set({
                        isAdminLoggedIn: token.claims.admin === true,
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
                    if (snapshot.metadata.fromCache === false) {
                        // Seed initial config if it doesn't exist on the server
                        void safeFbCall(() => setDoc(doc(db, 'config', 'siteConfig'), defaultSiteConfig)).catch(() => undefined);
                    }
                    // Always set loaded to true so we don't freeze the app if cache is empty
                    set({ configLoaded: true });
                }
            }, (err) => {
                console.warn('Firebase config error (are credentials/rules set?):', err);
                set({ configLoaded: true });
            });

            // Listen to Projects
            onSnapshot(collection(db, 'projects'), (snapshot) => {
                const projects = snapshot.docs.map(d => d.data() as Project);
                if (projects.length > 0) {
                    set({ projects, projectsLoaded: true });
                } else {
                    if (snapshot.metadata.fromCache === false) {
                        // Seed initial data if empty and we actually connected to DB
                        defaultProjects.forEach(p => void safeFbCall(() => setDoc(doc(db, 'projects', p.id), p)).catch(() => undefined));
                    }
                    set({ projectsLoaded: true });
                }
            }, (err) => {
                console.warn('Firebase projects error:', err);
                set({ projectsLoaded: true }); // Prevent UI from being stuck
            });

            // Listen to Skills
            onSnapshot(collection(db, 'skills'), (snapshot) => {
                const skills = snapshot.docs.map(d => d.data() as Skill);
                if (skills.length > 0) {
                    set({ skills });
                } else if (snapshot.metadata.fromCache === false) {
                    defaultSkills.forEach(s => void safeFbCall(() => setDoc(doc(db, 'skills', s.id), s)).catch(() => undefined));
                }
            }, (err) => console.warn('Firebase skills error:', err));

            // Listen to Experiences
            onSnapshot(collection(db, 'experiences'), (snapshot) => {
                const experiences = snapshot.docs.map(d => d.data() as Experience);
                if (experiences.length > 0) {
                    set({ experiences });
                } else if (snapshot.metadata.fromCache === false) {
                    defaultExperiences.forEach(e => void safeFbCall(() => setDoc(doc(db, 'experiences', e.id), e)).catch(() => undefined));
                }
            }, (err) => console.warn('Firebase experiences error:', err));

            // Listen to Certificates
            onSnapshot(collection(db, 'certificates'), (snapshot) => {
                const certificates = snapshot.docs.map(d => d.data() as Certificate);
                if (certificates.length > 0) {
                    set({ certificates });
                } else if (snapshot.metadata.fromCache === false) {
                    defaultCertificates.forEach((c) => void safeFbCall(() => setDoc(doc(db, 'certificates', c.id), c)).catch(() => undefined));
                }
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
        try {
            const credential = await signInWithEmailAndPassword(auth, email, password);
            const token = await getIdTokenResult(credential.user);
            if (token.claims.admin !== true) {
                await signOut(auth);
                return false;
            }
            return true;
        } catch (e) {
            console.error('Firebase Auth error:', e);
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
