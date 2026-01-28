import { CNCOutput, MachineOperationType, OperationParams, StockDimensions, ToolType } from "../types";
import { SIEMENS_HEADER } from "../constants";

const fmt = (n: number | undefined | null) => {
  if (n === undefined || n === null || isNaN(n)) return "0";
  return parseFloat(n.toFixed(3)).toString();
};

const getToolName = (type: ToolType, diameter: number): string => {
  switch (type) {
    case ToolType.DRILL: return `DRILL ${diameter}`;
    case ToolType.FACE_MILL: return `FACEMILL ${diameter}`;
    case ToolType.BALL_MILL: return `BALL ${diameter}`;
    case ToolType.END_MILL: default: return `CUTTER ${diameter}`;
  }
};

export const generateSiemensCode = (
  stock: StockDimensions,
  operations: OperationParams[],
  explanation: string
): CNCOutput => {
  let mainBlocks: string[] = [];
  let subBlocks: string[] = []; 

  const zAbs = -stock.height; 
  if (stock.shape === 'CYLINDRICAL') {
    mainBlocks.push(`WORKPIECE(,"",,"CYLINDER",0,0,${fmt(zAbs)},0,${fmt(stock.diameter)})`);
  } else {
    mainBlocks.push(`WORKPIECE(,"",,"RECTANGLE",0,0,${fmt(zAbs)},0,${fmt(stock.length)},${fmt(stock.width)})`);
  }
  mainBlocks.push(``);

  let currentToolName = "";

  operations.forEach((op, index) => {
    const contourName = `CONT_${index + 1}`; 
    const startLabel = `E_LAB_A_${contourName}`;
    const endLabel = `E_LAB_E_${contourName}`;

    mainBlocks.push(`; ------------------------------------`);
    mainBlocks.push(`; OP ${index + 1}: ${op.type}`);

    const toolName = getToolName(op.tool_type, op.tool_diameter);
    if (toolName !== currentToolName) {
        if (currentToolName !== "") {
            mainBlocks.push(`M05`);
            mainBlocks.push(`M09`);
            mainBlocks.push(`M01`);
        }
        mainBlocks.push(`T="${toolName}"`);
        mainBlocks.push(`M06`);
        mainBlocks.push(`M03 S${op.spindle_speed} M08`);
        mainBlocks.push(`D1`);
        currentToolName = toolName;
    }

    switch (op.type) {
        case MachineOperationType.FACE_MILL:
            const fmW = op.width || 100;
            const fmL = op.length || 100;
            const fmX = op.x - fmW/2;
            const fmY = op.y - fmL/2;
            mainBlocks.push(`CYCLE61(100, 1, 1, -${fmt(op.z_depth)}, ${fmt(fmX)}, ${fmt(fmY)}, ${fmt(fmW)}, ${fmt(fmL)}, 1, 1, ${fmt(op.step_down)}, ${fmt(op.feed_rate)}, 11, 0, 1, 1)`);
            break;

        case MachineOperationType.CIRCULAR_POCKET:
            mainBlocks.push(`CYCLE77(100, 0, 2, -${fmt(op.z_depth)}, , ${fmt(op.diameter)}, ${fmt(op.x)}, ${fmt(op.y)}, ${fmt(op.step_down)}, ${fmt(op.feed_rate)}, ${fmt(op.feed_rate)}, 0, 0, 0, 1, )`);
            break;

        case MachineOperationType.RECTANGULAR_POCKET:
            mainBlocks.push(`POCKET3(100, 0, 2, -${fmt(op.z_depth)}, , ${fmt(op.width)}, ${fmt(op.length)}, 0, ${fmt(op.x)}, ${fmt(op.y)}, 0, ${fmt(op.feed_rate)}, ${fmt(op.feed_rate)}, ${fmt(op.step_down)}, 2, 0, 0, , , )`);
            break;

        case MachineOperationType.DRILL:
            mainBlocks.push(`MCALL CYCLE81(100, 0, 2, -${fmt(op.z_depth)}, 0)`);
            mainBlocks.push(`HOLES1(${fmt(op.x)}, ${fmt(op.y)}, 0, 0, 0, 1)`);
            mainBlocks.push(`MCALL`);
            break;

        case MachineOperationType.CONTOUR:
            mainBlocks.push(`CYCLE62("${contourName}", 1, , )`);
            mainBlocks.push(`CYCLE63("${contourName}", 1, 100, 0, 1, ${fmt(op.z_depth)}, 0.1, , ${fmt(op.step_down)}, 9, 0.1, 0.1, 0, , , , , , 1, 2, , , , 0, 100201, 101)`);
            
            subBlocks.push(``);
            subBlocks.push(`${startLabel}: ;#SM Z:2`);
            subBlocks.push(`;#7__DlgK contour definition begin - Don't change!;*GP*;*RO*;*HD*`);
            subBlocks.push(`G17 G90 DIAMOF;*GP*`);
            
            // Initial Point
            subBlocks.push(`G0 X${fmt(op.x)} Y${fmt(op.y)} ;*GP*`);
            
            if (op.path_segments) {
                op.path_segments.forEach(seg => {
                    if (seg.type === 'LINE') {
                        subBlocks.push(`G1 X${fmt(seg.x)} Y${fmt(seg.y)} ;*GP*`);
                    } else if (seg.type === 'ARC_CW') {
                        // G2 X Y I=AC(cx) J=AC(cy)
                        subBlocks.push(`G2 X${fmt(seg.x)} Y${fmt(seg.y)} I=AC(${fmt(seg.cx)}) J=AC(${fmt(seg.cy)}) ;*GP*`);
                    } else if (seg.type === 'ARC_CCW') {
                        // G3 X Y I=AC(cx) J=AC(cy)
                        subBlocks.push(`G3 X${fmt(seg.x)} Y${fmt(seg.y)} I=AC(${fmt(seg.cx)}) J=AC(${fmt(seg.cy)}) ;*GP*`);
                    }
                });
                
                // Optional: Check closure
                // ...
            }
            
            subBlocks.push(`;#End contour definition end - Don't change!;*GP*;*RO*;*HD*`);
            subBlocks.push(`${endLabel}:`);
            break;
    }
    mainBlocks.push(``);
  });

  mainBlocks.push(`M05`);
  mainBlocks.push(`M09`);
  mainBlocks.push(`M30`);

  const fullCode = [
    `; Siemens ShopMill Generator`,
    `G17 G90 G54`,
    `G64 P0.01`,
    ``,
    ...mainBlocks,
    ...subBlocks
  ].join('\n');

  return {
    gcode: fullCode,
    explanation,
    operations,
    stock
  };
};