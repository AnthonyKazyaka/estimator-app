export interface Plan {
  name: string; // Short descriptive name of the plan
  cost: number; // Estimated cost of the plan
  details: string; // Detailed description of the plan
  timeline: string; // Estimated time required for the plan
  resources: string[]; // List of resources required for the plan
  photoRequiredForEstimate: boolean; // Does the plan require a photo for further detail?
}
