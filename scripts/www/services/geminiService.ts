import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MachineOperationType, OperationParams, StockDimensions, AppMode, ModelOption, ToolType } from "../types";

const GEN_SYSTEM_INSTRUCTION = `
You are an expert CNC Programmer for Siemens Sinumerik 840D.
The user needs "ShopMill" style programming with "CYCLE62" (Contour Call) and specific Contour Definitions.

CRITICAL REQUIREMENT:
The part likely contains CURVES and ARCS. Do NOT approximate them as lines.
You MUST identify:
1. Linear moves (G1) -> Type: "LINE"
2. Clockwise Arcs (G2) -> Type: "ARC_CW"
3. Counter-Clockwise Arcs (G3) -> Type: "ARC_CCW"

For Arcs, you MUST provide the CENTER coordinates (cx, cy). This corresponds to Siemens "I=AC(...) J=AC(...)".

JSON Structure:
{
  "stock": { "shape", "width", "length", "height", "diameter", "material" },
  "operation": {
      "type": "CONTOUR" (or POCKET/DRILL),
      "tool_type": "END_MILL",
      "x": start_x, 
      "y": start_y,
      "z_depth": depth,
      "path_segments": [
          { "type": "LINE", "x": end_x, "y": end_y },
          { "type": "ARC_CCW", "x": end_x, "y": end_y, "cx": center_x, "cy": center_y }
      ]
      ...
  },
  "explanation": "Brief summary in Chinese"
}

If the user provides a PDF/Image of the "Face Groove Wheel Part" (端面槽轮零件):
- Use 'gemini-3-pro' logic to trace the curves accurately.
- The contours are complex. Return "CONTOUR" type.
- Extract the start point (x,y).
- Then list the sequence of segments to form the closed loop.
`;

const OPT_SYSTEM_INSTRUCTION = `
You are an expert CNC Code Optimizer for Siemens Sinumerik 840D.
Output valid JSON with "optimized_gcode", "explanation", "stock", and "operation".
`;

export interface Attachment {
  data: string;     
  mimeType: string;
  fileName?: string;
}

export const analyzeRequest = async (
  prompt: string, 
  attachment?: Attachment, 
  model: ModelOption = 'gemini-3-flash-preview',
  mode: AppMode = 'GENERATE'
): Promise<{
  stock: StockDimensions;
  operation: OperationParams;
  explanation: string;
  optimized_gcode?: string;
}> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");

  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [];
  
  if (attachment) {
    if (attachment.mimeType === 'application/x-solidworks-part') {
        parts.push({ 
            text: `[User uploaded SolidWorks file "${attachment.fileName}". Assume typical machined part geometry.]` 
        });
    } else {
        parts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.data
          }
        });
    }
  }

  parts.push({ text: prompt });

  let selectedModel: string = model;
  if (attachment && attachment.mimeType.startsWith('image/') && model === 'gemini-2.5-flash') {
     selectedModel = 'gemini-2.5-flash-image';
  }

  const supportsSchema = selectedModel !== 'gemini-2.5-flash-image';

  // Fallback for non-schema models
  if (!supportsSchema) {
      parts.push({ text: "\n\nRETURN JSON ONLY. Format: { stock: {...}, operation: { ..., path_segments: [{type:'LINE'|'ARC_CW'|'ARC_CCW', x, y, cx, cy}] }, explanation }" });
  }

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      stock: {
        type: Type.OBJECT,
        properties: {
          shape: { type: Type.STRING, enum: ["RECTANGULAR", "CYLINDRICAL"] },
          width: { type: Type.NUMBER },
          length: { type: Type.NUMBER },
          height: { type: Type.NUMBER },
          diameter: { type: Type.NUMBER },
          material: { type: Type.STRING }
        },
        required: ["shape", "height"]
      },
      operation: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["CIRCULAR_POCKET", "RECTANGULAR_POCKET", "DRILL", "FACE_MILL", "CONTOUR"] },
          tool_type: { type: Type.STRING, enum: ["END_MILL", "BALL_MILL", "DRILL", "FACE_MILL"] },
          x: { type: Type.NUMBER },
          y: { type: Type.NUMBER },
          z_start: { type: Type.NUMBER },
          z_depth: { type: Type.NUMBER },
          diameter: { type: Type.NUMBER },
          width: { type: Type.NUMBER },
          length: { type: Type.NUMBER },
          feed_rate: { type: Type.NUMBER },
          spindle_speed: { type: Type.NUMBER },
          tool_diameter: { type: Type.NUMBER },
          step_down: { type: Type.NUMBER },
          path_segments: { 
            type: Type.ARRAY, 
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["LINE", "ARC_CW", "ARC_CCW"] },
                x: { type: Type.NUMBER, description: "End Point X" },
                y: { type: Type.NUMBER, description: "End Point Y" },
                cx: { type: Type.NUMBER, description: "Center X (Absolute) for Arcs" },
                cy: { type: Type.NUMBER, description: "Center Y (Absolute) for Arcs" }
              },
              required: ["type", "x", "y"]
            }
          }
        },
        required: ["type", "x", "y", "z_depth"]
      },
      explanation: { type: Type.STRING },
      optimized_gcode: { type: Type.STRING }
    },
    required: ["stock", "operation", "explanation"]
  };

  const config: any = {
      systemInstruction: mode === 'OPTIMIZE' ? OPT_SYSTEM_INSTRUCTION : GEN_SYSTEM_INSTRUCTION,
  };

  if (supportsSchema) {
      config.responseMimeType = "application/json";
      config.responseSchema = schema;
  }

  const response = await ai.models.generateContent({
    model: selectedModel,
    contents: { parts: parts },
    config: config
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");

  try {
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);
  } catch (e) {
    throw new Error("AI JSON Error");
  }
};