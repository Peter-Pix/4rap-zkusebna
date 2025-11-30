
export interface Beat {
  id: string;
  title: string;
  bpm: number;
  genre: string;
  url: string; // URL to the audio file
  coverImage: string;
}

export interface Recording {
  id: string;
  beatId: string;
  beatTitle: string;
  name: string;
  date: string;
  blobUrl: string; // Temporary session URL
  duration: number;
}

export interface LyricSheet {
  id: string;
  title: string;
  content: string;
  lastEdited: number;
}

export interface Artist {
  id: string;
  name: string;
  bio: string;
  image: string;
  tags: string[];
}

export interface MixSettings {
  bass: number;
  treble: number;
  reverb: number;
  echo: number;
  denoise: number;
}

export interface MixerPreset {
  id: string;
  name: string;
  settings: MixSettings;
  isDefault?: boolean;
}

export enum AppRoute {
  HOME = 'home',
  STUDIO = 'studio',
  PROFILE = 'profile'
}
