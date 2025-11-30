import { Beat, Artist } from './types';

// Using consistent placeholder audio that is copyright free / creative commons for demo purposes
const DEMO_BEAT_URL = "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=hip-hop-rock-beats-118000.mp3"; 

export const BEATS: Beat[] = [
  {
    id: '3',
    title: 'Sídliště Sen',
    bpm: 120,
    genre: 'Lo-Fi',
    url: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112778.mp3",
    coverImage: 'https://picsum.photos/200/200?random=3'
  },
  {
    id: '6',
    title: 'Future Vision',
    bpm: 130,
    genre: 'Cyber',
    url: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=lofi-chill-medium-version-113524.mp3",
    coverImage: 'https://picsum.photos/200/200?random=6'
  }
];

export const ARTISTS: Artist[] = [
  {
    id: 'ben',
    name: 'Ben Cristovao',
    bio: 'Ben Cristovao, plným jménem Ben da Silva Cristóvão, se narodil 8. června 1987 v Plzni. Jeho otec pochází z Angoly a matka je Češka...',
    image: 'https://images.unsplash.com/photo-1598550832203-51b883070113?q=80&w=600&auto=format&fit=crop', // Placeholder approximating the look
    tags: ['UMĚLEC', 'PROFIL']
  },
  {
    id: 'bulhar',
    name: 'Ca$hanova Bulhar',
    bio: 'V šumu velkoměsta Prahy se zrodila hvězda českého rapu, která se dnes těší velké popularitě doma i za hranicemi. Matěj Kratejl, známější pod uměleckým jménem Ca$hanova Bulhar...',
    image: 'https://images.unsplash.com/photo-1520699918507-afc75531d0db?q=80&w=600&auto=format&fit=crop',
    tags: ['UMĚLEC', 'TRAP']
  }
];

export const STORAGE_KEY = 'zkusebna_recordings_v1';