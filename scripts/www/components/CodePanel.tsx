import React from 'react';
import { CNCOutput, ToolType } from '../types';

interface CodePanelProps {
  data: CNCOutput | null;
}

const CodePanel: React.FC<CodePanelProps> = ({ data }) => {
  const downloadCode = () => {
    if (!data) return;
    const blob = new Blob([data.gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'program.mpf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getToolIcon = (type: ToolType) => {
    switch (type) {
        case ToolType.DRILL: return 'fa-screwdriver';
        case ToolType.FACE_MILL: return 'fa-layer-group';
        case ToolType.BALL_MILL: return 'fa-circle';
        default: return 'fa-pen-nib';
    }
  };

  if (!data) {
    return (
      <div className="glass-panel h-full w-full rounded-3xl flex flex-col items-center justify-center text-slate-300 border-dashed border-2 border-slate-200/50 bg-white/30">
        <i className="fa-solid fa-code text-5xl mb-4 opacity-50"></i>
        <p className="font-medium tracking-wide text-slate-400">等待代码生成</p>
      </div>
    );
  }

  return (
    <div className="glass-panel h-full flex flex-col rounded-3xl overflow-hidden shadow-xl shadow-slate-200/40 relative group bg-white/40">
      {/* Header */}
      <div className="bg-white/60 px-5 py-3 border-b border-slate-100 flex justify-between items-center backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
            <div className="flex gap-1.5 mr-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400 border border-red-500/20"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 border border-yellow-500/20"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 border border-green-500/20"></div>
            </div>
            <span className="text-xs font-medium text-slate-500 ml-2 font-mono">program.mpf</span>
        </div>
        
        <button
          onClick={downloadCode}
          className="text-[10px] font-bold bg-white/50 hover:bg-white text-slate-600 px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 border border-slate-200/50 backdrop-blur-sm"
        >
          <i className="fa-solid fa-download"></i> 导出 MPF
        </button>
      </div>
      
      {/* Scrollable Params */}
      <div className="bg-slate-50/30 px-4 py-2 border-b border-slate-100/50 flex overflow-x-auto gap-3 scrollbar-hide backdrop-blur-sm shrink-0">
         {data.operations.map((op, i) => (
             <div key={i} className="flex items-center gap-2 bg-white/60 px-2.5 py-1 rounded-lg border border-slate-200/50 flex-shrink-0 transition-all hover:shadow-sm">
                 <span className="text-[10px] text-slate-400 font-bold">工序{i+1}</span>
                 <i className={`fa-solid ${getToolIcon(op.tool_type)} text-cyan-600 text-[10px]`}></i>
                 <span className="text-slate-700 font-mono text-xs">D{op.tool_diameter}</span>
                 <span className="text-slate-300 text-[10px]">|</span>
                 <span className="text-blue-600 text-[10px] font-medium tracking-tight">{op.type.split('_')[0]}</span>
             </div>
         ))}
      </div>

      {/* Editor Area - Flex 1 to take remaining height, overflow-y-auto to scroll */}
      <div className="flex-1 overflow-y-auto p-5 font-mono text-sm bg-white/30 backdrop-blur-sm custom-scrollbar">
        <div className="text-xs leading-relaxed">
          {data.gcode.split('\n').map((line, i) => (
             <div key={i} className="flex group/line hover:bg-white/50 px-1 rounded-sm transition-colors">
                <span className="text-slate-300 select-none w-8 text-right mr-4 flex-shrink-0 text-[10px] py-0.5">{i+1}</span>
                <span className={`${
                    line.startsWith(';') ? 'text-green-600/80 italic' : 
                    line.includes('G0 ') || line.includes('G1 ') ? 'text-blue-600' :
                    line.includes('M') ? 'text-pink-600' :
                    line.includes('T') ? 'text-orange-600' :
                    'text-slate-700'
                }`}>{line}</span>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CodePanel;