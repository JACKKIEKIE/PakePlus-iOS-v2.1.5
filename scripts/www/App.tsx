import React, { useState } from 'react';
import ChatPanel from './components/ChatPanel';
import CodePanel from './components/CodePanel';
import SimulationPanel from './components/SimulationPanel';
import { CNCOutput, AppMode, ModelOption, OperationParams, StockDimensions, ChatMessage } from './types';
import { analyzeRequest, Attachment } from './services/geminiService';
import { generateSiemensCode } from './services/cncGenerator';

const App: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cncData, setCncData] = useState<CNCOutput | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  // Mobile Tab State
  const [activeTab, setActiveTab] = useState<'chat' | 'sim' | 'code'>('chat');
  
  // New State: Operation History for Code Generation context
  const [operations, setOperations] = useState<OperationParams[]>([]);
  const [currentStock, setCurrentStock] = useState<StockDimensions>({ 
    shape: 'RECTANGULAR',
    width: 100, 
    length: 100, 
    height: 20, 
    diameter: 0,
    material: "Aluminum" 
  });

  const handleReset = () => {
      setOperations([]);
      setCncData(null);
      setMessages([]);
  };

  const handleSendMessage = async (
    text: string, 
    attachment: Attachment | null, 
    model: ModelOption, 
    mode: AppMode
  ) => {
    setIsProcessing(true);
    
    // Add User Message
    const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        text: text || (attachment ? `已上传文件: ${attachment.fileName}` : '...'),
        attachment: attachment?.data
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      let prompt = text;
      // Smart prompt defaults
      if (!prompt && mode === 'GENERATE') {
         if (attachment?.mimeType === 'text/plain') prompt = "分析这个 DXF/文本文件的数据并生成加工程序。";
         else if (attachment?.mimeType === 'application/pdf') prompt = "分析这张 PDF 图纸并生成加工程序。";
         else prompt = "分析这个图像/模型并生成加工程序。";
      }

      // 1. Analyze
      const analysis = await analyzeRequest(prompt, attachment || undefined, model, mode);
      
      // 2. Generate Result
      let result: CNCOutput;

      if (mode === 'OPTIMIZE' && analysis.optimized_gcode) {
          const ops = [analysis.operation];
          result = {
              gcode: analysis.optimized_gcode,
              explanation: analysis.explanation,
              operations: ops,
              stock: analysis.stock
          };
          setOperations(ops);
          setCurrentStock(analysis.stock);
      } else {
          // GENERATE: Accumulate operations
          const newOps = [...operations, analysis.operation];
          setOperations(newOps);
          setCurrentStock(analysis.stock);
          result = generateSiemensCode(analysis.stock, newOps, analysis.explanation);
      }
      
      // Update Visualization Data
      setCncData(result);

      // Auto switch to Sim tab on mobile if data is generated
      if (window.innerWidth < 1024) {
          setActiveTab('sim');
      }

      // Add AI Message
      const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          text: result.explanation,
          cncResult: result
      };
      setMessages(prev => [...prev, aiMsg]);

    } catch (err: any) {
      console.error(err);
      const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          text: `⚠️ 错误: ${err.message || "无法处理您的请求，请稍后重试。"}`
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    // Use h-[100dvh] for mobile browser address bar adaptability
    <div className="h-[100dvh] flex flex-col text-slate-800 selection:bg-blue-500/20 overflow-hidden bg-[#f5f5f7]">
      
      {/* Header */}
      <header className="h-12 lg:h-14 flex items-center px-4 lg:px-6 sticky top-0 z-50 glass-panel border-b border-white/40 shrink-0">
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="bg-gradient-to-tr from-blue-600 to-cyan-500 w-6 h-6 lg:w-7 lg:h-7 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <i className="fa-solid fa-microchip text-white text-[10px] lg:text-xs"></i>
          </div>
          <h1 className="text-sm lg:text-base font-medium tracking-tight text-slate-900">
            西门子 <span className="text-slate-400 font-light">AI 编程助手</span>
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-4 text-sm">
            {messages.length > 0 && (
                <button 
                    onClick={handleReset}
                    className="flex items-center gap-2 text-slate-500 hover:text-red-500 transition-colors bg-white/50 hover:bg-red-50 px-2 py-1 lg:px-3 rounded-lg border border-slate-200/50 backdrop-blur-sm text-xs"
                >
                    <i className="fa-solid fa-trash-can"></i>
                    <span className="hidden lg:inline">重置会话</span>
                </button>
            )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-2 lg:p-6 w-full max-w-[1920px] mx-auto min-h-0 overflow-hidden">
        <div className="h-full w-full lg:grid lg:grid-cols-12 lg:gap-6 relative">
          
          {/* Left Column: Chat Interface */}
          {/* On Mobile: Visible only if activeTab is 'chat' */}
          <div className={`
             h-full lg:col-span-5 min-h-0 transition-all duration-300
             ${activeTab === 'chat' ? 'block' : 'hidden lg:block'}
          `}>
             <ChatPanel 
               onSendMessage={handleSendMessage} 
               isProcessing={isProcessing} 
               messages={messages} 
             />
          </div>

          {/* Right Column: Visualization & Code */}
          {/* On Mobile: Container handles flex layout, children toggle visibility */}
          <div className={`
             h-full lg:col-span-7 min-h-0 flex-col gap-2 lg:gap-6
             ${activeTab !== 'chat' ? 'flex' : 'hidden lg:flex'}
          `}>
            
            {/* Top: 3D Simulation */}
            <div className={`
                min-h-0 overflow-hidden transition-all duration-300
                ${activeTab === 'sim' ? 'flex-1' : 'hidden lg:flex lg:flex-[1.5]'}
            `}>
              <SimulationPanel data={cncData} />
            </div>

            {/* Bottom: G-Code */}
            <div className={`
                min-h-0 overflow-hidden transition-all duration-300
                ${activeTab === 'code' ? 'flex-1' : 'hidden lg:flex lg:flex-1'}
            `}>
              <CodePanel data={cncData} />
            </div>

          </div>

        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden bg-white/90 backdrop-blur-xl border-t border-slate-200/60 pb-safe pt-1 px-4 flex justify-between items-center shrink-0 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
           <button 
             onClick={() => setActiveTab('chat')} 
             className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95 ${activeTab === 'chat' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-400 hover:text-slate-600'}`}
           >
              <i className="fa-solid fa-robot text-xl mb-0.5"></i>
              <span className="text-[10px] font-medium">助手</span>
           </button>
           <div className="w-px h-8 bg-slate-100 mx-2"></div>
           <button 
             onClick={() => setActiveTab('sim')} 
             className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95 ${activeTab === 'sim' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-400 hover:text-slate-600'}`}
           >
              <i className="fa-solid fa-cube text-xl mb-0.5"></i>
              <span className="text-[10px] font-medium">仿真</span>
              {cncData && activeTab !== 'sim' && (
                <span className="absolute top-2 right-[35%] w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              )}
           </button>
           <button 
             onClick={() => setActiveTab('code')} 
             className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-95 ${activeTab === 'code' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-400 hover:text-slate-600'}`}
           >
              <i className="fa-solid fa-code text-xl mb-0.5"></i>
              <span className="text-[10px] font-medium">代码</span>
           </button>
       </nav>

    </div>
  );
};

export default App;