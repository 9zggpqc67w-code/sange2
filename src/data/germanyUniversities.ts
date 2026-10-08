/**
 * Germany's Top 10 Universities for the Infinite Horizontal Sliding Marquee.
 * Hand-curated with verified data and high-definition architectural imagery.
 */

export interface GermanUniversity {
  id: string;
  initials: string;
  shortName: string;
  fullName: string;
  city: string;
  state: string;
  country: string;
  focus: string;
  image: string;
  badgeColor?: string;
}

export const germanUniversities: GermanUniversity[] = [
  {
    id: 'tum',
    initials: 'TUM',
    shortName: 'Technical University of Munich',
    fullName: 'Technische Universität München',
    city: 'Munich',
    state: 'Bavaria',
    country: 'Germany',
    focus: 'Excellence University · Engineering & AI',
    image: 'https://images.unsplash.com/photo-1595867818082-083862f3d630?q=80&w=800&auto=format&fit=crop',
    badgeColor: 'bg-blue-600',
  },
  {
    id: 'lmu',
    initials: 'LMU',
    shortName: 'LMU Munich',
    fullName: 'Ludwig-Maximilians-Universität München',
    city: 'Munich',
    state: 'Bavaria',
    country: 'Germany',
    focus: 'Leading Humanities, Law & Medicine',
    image: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=800&auto=format&fit=crop',
    badgeColor: 'bg-emerald-600',
  },
  {
    id: 'heidelberg',
    initials: 'UNI HD',
    shortName: 'Heidelberg University',
    fullName: 'Ruprecht-Karls-Universität Heidelberg',
    city: 'Heidelberg',
    state: 'Baden-Württemberg',
    country: 'Germany',
    focus: "Germany's Oldest University (Est. 1386)",
    image: 'https://images.unsplash.com/photo-1527866959252-deab85ef7d1b?q=80&w=800&auto=format&fit=crop',
    badgeColor: 'bg-indigo-600',
  },
  {
    id: 'rwth',
    initials: 'RWTH',
    shortName: 'RWTH Aachen University',
    fullName: 'Rheinisch-Westfälische Technische Hochschule Aachen',
    city: 'Aachen',
    state: 'North Rhine-Westphalia',
    country: 'Germany',
    focus: 'Top Mechanical & Industrial Research',
    image: 'https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=800&auto=format&fit=crop',
    badgeColor: 'bg-blue-700',
  },
  {
    id: 'kit',
    initials: 'KIT',
    shortName: 'Karlsruhe Institute of Technology',
    fullName: 'Karlsruher Institut für Technologie',
    city: 'Karlsruhe',
    state: 'Baden-Württemberg',
    country: 'Germany',
    focus: 'National Research Center in Helmholtz',
    image: 'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?q=80&w=800&auto=format&fit=crop',
    badgeColor: 'bg-teal-600',
  },
  {
    id: 'hu-berlin',
    initials: 'HU',
    shortName: 'Humboldt University of Berlin',
    fullName: 'Humboldt-Universität zu Berlin',
    city: 'Berlin',
    state: 'Berlin',
    country: 'Germany',
    focus: 'Humboldtian Model of Higher Education',
    image: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?q=80&w=800&auto=format&fit=crop',
    badgeColor: 'bg-blue-800',
  },
  {
    id: 'fu-berlin',
    initials: 'FU',
    shortName: 'Freie Universität Berlin',
    fullName: 'Freie Universität Berlin',
    city: 'Berlin',
    state: 'Berlin',
    country: 'Germany',
    focus: 'Social Sciences & Global Research Hub',
    image: 'https://images.unsplash.com/photo-1566404791232-af9fe0ae8f8b?q=80&w=800&auto=format&fit=crop',
    badgeColor: 'bg-cyan-700',
  },
  {
    id: 'freiburg',
    initials: 'UNI FR',
    shortName: 'University of Freiburg',
    fullName: 'Albert-Ludwigs-Universität Freiburg',
    city: 'Freiburg',
    state: 'Baden-Württemberg',
    country: 'Germany',
    focus: 'Classic Elite University & Environmental Tech',
    image: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=800&auto=format&fit=crop',
    badgeColor: 'bg-emerald-700',
  },
  {
    id: 'hamburg',
    initials: 'UHH',
    shortName: 'University of Hamburg',
    fullName: 'Universität Hamburg',
    city: 'Hamburg',
    state: 'Hamburg',
    country: 'Germany',
    focus: 'Excellence Cluster in Climate & Physics',
    image: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?q=80&w=800&auto=format&fit=crop',
    badgeColor: 'bg-sky-700',
  },
  {
    id: 'tu-berlin',
    initials: 'TUB',
    shortName: 'TU Berlin',
    fullName: 'Technische Universität Berlin',
    city: 'Berlin',
    state: 'Berlin',
    country: 'Germany',
    focus: 'Member of TU9 · High-Tech & Mobility',
    image: 'https://images.unsplash.com/photo-1587330979470-3595ac045ab0?q=80&w=800&auto=format&fit=crop',
    badgeColor: 'bg-rose-700',
  },
];
