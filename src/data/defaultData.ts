import type { Project, SiteConfig, Skill, Experience, Certificate } from '../types';

// Keep seed data specific to this portfolio. Do not ship another developer's
// sample projects, contact details, education history, or certificates.
export const defaultProjects: Project[] = [];

export const defaultSiteConfig: SiteConfig = {
    name: 'Montel Anthony',
    navbarName: 'Montelent',
    tagline: 'Montelent',
    bio: 'Full-stack web developer building modern websites, web applications, and digital experiences.',
    aboutTitle: "Hi, I'm Montel Anthony",
    aboutMe: 'I build and customize websites and web applications, with an interest in technology, digital products, and practical solutions for businesses.',
    email: '',
    phone: '',
    location: 'Nigeria',
    availableForWork: true,
    heroTitle: 'Full-Stack Developer',
    github: 'https://github.com/Montelent',
    linkedin: 'https://www.linkedin.com/in/montelent',
    twitter: '',
    instagram: '',
    resumeUrl: '',
    profileImage: '',
    accentColor: '#6366f1',
    theme: 'dark',
    projectCategories: ['web', 'mobile'],
    pageTitle: 'Montel Anthony | Full-Stack Developer',
    metaDescription: 'Montel Anthony (Montelent) — Full-Stack Developer building modern websites and web applications.',
    siteUrl: 'https://portfolio.montelent.com/',
    ogImage: 'https://res.cloudinary.com/fbpgkoki/image/upload/c_fill,w_1200,h_630,f_png/v1788027554/My_Preview_Social.jpg?v=2',
};

export const defaultSkills: Skill[] = [];

export const defaultExperiences: Experience[] = [];

export const defaultCertificates: Certificate[] = [];
