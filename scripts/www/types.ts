
export enum MachineOperationType {
  CIRCULAR_POCKET = 'CIRCULAR_POCKET',
  RECTANGULAR_POCKET = 'RECTANGULAR_POCKET',
  DRILL = 'DRILL',
  FACE_MILL = 'FACE_MILL',
  CONTOUR = 'CONTOUR',
  UNKNOWN = 'UNKNOWN'
}

export enum ToolType {
  END_MILL = 'END_MILL',
  BALL_MILL = 'BALL_MILL',
  DRILL = 'DRILL',
  FACE_MILL = 'FACE_MILL'
}

export interface StockDimensions {
  shape: 'RECTANGULAR' | 'CYLINDRICAL';
  width: number;
  length: number;
  height: number;
  diameter: number;
  material: string;
}

// New Segment Type for Arcs
export type SegmentType = 'LINE' | 'ARC_CW' | 'ARC_CCW';

export interface PathSegment {
  type: SegmentType;
  x: number;      // End point X
  y: number;      // End point Y
  cx?: number;    // Center X (for Arcs)
  cy?: number;    // Center Y (for Arcs)
  radius?: number;// Optional Radius fallback
}

export interface OperationParams {
  type: MachineOperationType;
  x: number; // Start X or Center X
  y: number; // Start Y or Center Y
  z_start: number;
  z_depth: number;
  diameter?: number; 
  width?: number; 
  length?: number; 
  
  // Replaced simple points with Segments
  path_segments?: PathSegment[]; 
  
  feed_rate: number;
  spindle_speed: number;
  tool_diameter: number;
  tool_type: ToolType;
  step_down: number;
}

export interface CNCOutput {
  gcode: string;
  explanation: string;
  operations: OperationParams[];
  stock: StockDimensions;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  attachment?: string;
  cncResult?: CNCOutput;
}

export type AppMode = 'GENERATE' | 'OPTIMIZE';
export type ModelOption = 'gemini-3-flash-preview' | 'gemini-3-pro-preview' | 'gemini-2.5-flash';
