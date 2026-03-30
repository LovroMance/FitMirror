export type ExerciseBodyPart = 'core' | 'upper' | 'lower' | 'full_body' | 'mobility';
export type ExerciseLevel = 'beginner' | 'intermediate' | 'advanced';
export type ExerciseEquipment = 'none' | 'mat' | 'dumbbell' | 'band' | 'chair';

export interface ExerciseItem {
  id: string;
  name: string;
  bodyPart: ExerciseBodyPart;
  level: ExerciseLevel;
  equipment: ExerciseEquipment;
  durationMinutes: number;
  sets: number;
  reps: string;
  description: string;
  instructions: string[];
  tips: string[];
  tags: string[];
}

export interface ExerciseFilters {
  keyword: string;
  bodyPart: ExerciseBodyPart | 'all';
  level: ExerciseLevel | 'all';
  equipment: ExerciseEquipment | 'all';
}
