import type { ReleaseTrainTask, ReleaseTrainTrack } from '../types.js';

export interface RoadmapCatalogEntry {
  line: string;
  track: Omit<ReleaseTrainTrack, 'line'>;
  tasks: ReleaseTrainTask[];
}
