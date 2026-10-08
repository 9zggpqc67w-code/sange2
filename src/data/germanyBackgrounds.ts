/**
 * Curated Germany-themed background images for the rotating slideshow.
 * Includes iconic landmarks, universities, and landscapes.
 * Each image has a title, location, and fallback info.
 */

export interface GermanyBackgroundImage {
  id: string;
  url: string;
  title: string;
  location: string;
  alt: string;
}

export const germanyBackgroundImages: GermanyBackgroundImage[] = [
  {
    id: 'berlin-brandenburg',
    url: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?q=80&w=1920&auto=format&fit=crop',
    title: 'Brandenburg Gate',
    location: 'Berlin, Germany',
    alt: 'Historic Brandenburg Gate in Berlin',
  },
  {
    id: 'heidelberg-university',
    url: 'https://images.unsplash.com/photo-1527866959252-deab85ef7d1b?q=80&w=1920&auto=format&fit=crop',
    title: 'Heidelberg & Neckar River',
    location: 'Heidelberg, Baden-Württemberg',
    alt: 'Historic university city of Heidelberg with castle and Old Bridge',
  },
  {
    id: 'munich-architecture',
    url: 'https://images.unsplash.com/photo-1595867818082-083862f3d630?q=80&w=1920&auto=format&fit=crop',
    title: 'Marienplatz & Gothic Architecture',
    location: 'Munich, Bavaria',
    alt: 'Munich city center with gothic architecture and TUM vicinity',
  },
  {
    id: 'german-library',
    url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1920&auto=format&fit=crop',
    title: 'German University Library & Campus',
    location: 'Academic Research Center, Germany',
    alt: 'Modern German university research library and campus students',
  },
  {
    id: 'berlin-museum-island',
    url: 'https://images.unsplash.com/photo-1566404791232-af9fe0ae8f8b?q=80&w=1920&auto=format&fit=crop',
    title: 'Museum Island & Berlin Cathedral',
    location: 'Berlin, Germany',
    alt: 'Berlin Cathedral on Spree River at dusk',
  },
  {
    id: 'bavarian-landscape',
    url: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1920&auto=format&fit=crop',
    title: 'Bavarian Alps & Historic Landscapes',
    location: 'Bavaria, Germany',
    alt: 'Picturesque German architecture and alpine landscapes in Bavaria',
  },
];
