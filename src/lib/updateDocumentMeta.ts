import type { SiteConfig } from '../types';

function setMetaByName(name: string, content: string) {
    if (!content) return;
    let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
    }
    el.content = content;
}

function setMetaByProperty(property: string, content: string) {
    if (!content) return;
    let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
    }
    el.content = content;
}

function setLinkRel(rel: string, href: string) {
    if (!href) return;
    let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
    if (!el) {
        el = document.createElement('link');
        el.rel = rel;
        document.head.appendChild(el);
    }
    el.href = href;
}

/**
 * Applies Admin SEO / branding fields to the live document head.
 * Note: many social crawlers only read the initial HTML; this still keeps
 * the browser tab, in-app previews, and JS-capable bots in sync with Firebase.
 */
export function updateDocumentMeta(siteConfig: SiteConfig) {
    const title =
        siteConfig.pageTitle?.trim() ||
        [siteConfig.name, siteConfig.heroTitle].filter(Boolean).join(' | ') ||
        'Portfolio';

    const description =
        siteConfig.metaDescription?.trim() ||
        siteConfig.bio?.trim() ||
        '';

    const siteUrl =
        siteConfig.siteUrl?.trim() ||
        (typeof window !== 'undefined' ? window.location.origin : '');

    const ogImage =
        siteConfig.ogImage?.trim() ||
        siteConfig.profileImage?.trim() ||
        '';

    document.title = title;

    setMetaByName('description', description);
    setMetaByName('author', siteConfig.name || '');

    setMetaByProperty('og:title', title);
    setMetaByProperty('og:description', description);
    setMetaByProperty('og:type', 'website');
    if (siteUrl) setMetaByProperty('og:url', siteUrl);
    if (ogImage) setMetaByProperty('og:image', ogImage);
    setMetaByProperty('og:site_name', siteConfig.navbarName || siteConfig.name || 'Portfolio');

    setMetaByName('twitter:card', 'summary_large_image');
    setMetaByName('twitter:title', title);
    setMetaByName('twitter:description', description);
    if (ogImage) setMetaByName('twitter:image', ogImage);

    if (siteUrl) setLinkRel('canonical', siteUrl);
}
