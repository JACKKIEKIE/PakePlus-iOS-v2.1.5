import React, { useState, useRef, useEffect } from 'react';
import { Attachment } from '../services/geminiService';
import { AppMode, ModelOption, CNCOutput, ChatMessage } from '../types';

interface ChatPanelProps {
  onSendMessage: (text: string, attachment: Attachment | null, model: ModelOption, mode: AppMode) => void;
  isProcessing: boolean;
  messages: ChatMessage[];
}

const ChatPanel: React.FC<ChatPanelProps> = ({ onSendMessage, isProcessing, messages }) => {
  const [inputText, setInputText] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mode, setMode] = useState<AppMode>('GENERATE');
  const [model, setModel] = useState<ModelOption>('gemini-3-flash-preview');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const handleSend = () => {
    if ((!inputText.trim() && !attachment) || isProcessing) return;
    onSendMessage(inputText, attachment, model, mode);
    setInputText('');
    setAttachment(null);
    setFileName(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      if (file.type === 'application/pdf') {
        reader.onload = () => setAttachment({ data: (reader.result as string).split(',')[1], mimeType: 'application/pdf', fileName: file.name });
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('image/')) {
        reader.onload = () => setAttachment({ data: (reader.result as string).split(',')[1], mimeType: file.type, fileName: file.name });
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => setAttachment({ data: btoa(reader.result as string), mimeType: 'text/plain', fileName: file.name });
        reader.readAsText(file);
      }
    }
  };

  return (
    <div className="glass-panel h-full flex flex-col rounded-2xl lg:rounded-3xl overflow-hidden shadow-xl shadow-slate-200/40 bg-white/40 relative">
      
      {/* 1. Header Area (Controls) */}
      <div className="p-3 lg:p-4 border-b border-white/20 bg-white/30 backdrop-blur-md z-10 shrink-0">
        <div className="flex justify-between items-center mb-2 lg:mb-3">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-robot text-blue-500"></i> <span className="hidden sm:inline">智能助手</span>
            </h2>
            <div className="relative group">
                <select 
                    value={model} 
                    onChange={(e) => setModel(e.target.value as ModelOption)}
                    className="appearance-none bg-white/60 hover:bg-white/80 text-slate-600 text-[10px] font-medium py-1.5 pl-2 pr-6 rounded-md border border-slate-200/50 outline-none focus:border-blue-500 transition-all cursor-pointer"
                >
                    <option value="gemini-3-flash-preview">Gemini 3.0 Flash</option>
                    <option value="gemini-3-pro-preview">Gemini 3.0 Pro</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                </select>
                <i className="fa-solid fa-chevron-down absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-slate-400 pointer-events-none"></i>
            </div>
        </div>
        
        {/* Toggle Mode */}
        <div className="bg-slate-100/50 p-0.5 rounded-lg flex relative border border-slate-200/50">
            <div 
                className="absolute top-0.5 bottom-0.5 rounded-md bg-white shadow-sm border border-black/5 transition-all duration-300 ease-out"
                style={{ left: '2px', width: 'calc(50% - 2px)', transform: mode === 'OPTIMIZE' ? 'translateX(100%)' : 'translateX(0)' }} 
            />
            <button onClick={() => setMode('GENERATE')} className={`flex-1 relative z-10 py-1.5 text-[10px] font-bold transition-colors ${mode === 'GENERATE' ? 'text-slate-900' : 'text-slate-400'}`}>
                生成模式
            </button>
            <button onClick={() => setMode('OPTIMIZE')} className={`flex-1 relative z-10 py-1.5 text-[10px] font-bold transition-colors ${mode === 'OPTIMIZE' ? 'text-slate-900' : 'text-slate-400'}`}>
                优化模式
            </button>
        </div>
      </div>

      {/* 2. Chat History (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-4 lg:space-y-6 custom-scrollbar bg-slate-50/30">
        {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
                <i className="fa-solid fa-comments text-4xl mb-3"></i>
                <p className="text-xs">请描述加工需求或上传图纸</p>
            </div>
        )}
        
        {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`max-w-[95%] lg:max-w-[90%] rounded-2xl p-3 lg:p-4 shadow-sm border ${
                    msg.role === 'user' 
                    ? 'bg-blue-600 text-white border-blue-500 rounded-br-none' 
                    : 'bg-white/80 text-slate-700 border-white/50 rounded-bl-none'
                }`}>
                    {/* Message Content */}
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</div>
                    
                    {/* Attachment Indicator */}
                    {msg.attachment && (
                        <div className="mt-2 text-xs bg-black/10 px-2 py-1 rounded inline-flex items-center gap-1">
                            <i className="fa-solid fa-paperclip"></i> 附件已上传
                        </div>
                    )}

                    {/* AI Structured Data Display (Operations List) */}
                    {msg.role === 'ai' && msg.cncResult && (
                        <div className="mt-4 pt-3 border-t border-slate-200/50">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">工序分析</span>
                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 rounded">{msg.cncResult.stock.shape}</span>
                            </div>
                            <div className="space-y-2">
                                {msg.cncResult.operations.map((op, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">{idx + 1}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium truncate text-slate-800">{op.type}</div>
                                            <div className="text-[10px] text-slate-500">Z: {op.z_depth} | D{op.tool_diameter}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        ))}
        {isProcessing && (
            <div className="flex justify-start animate-pulse">
                <div className="bg-white/60 px-4 py-3 rounded-2xl rounded-bl-none text-slate-500 text-xs flex items-center gap-2">
                    <i className="fa-solid fa-circle-notch fa-spin"></i> 正在思考与生成...
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Input Area (Fixed Bottom) */}
      <div className="p-2 lg:p-3 bg-white/60 border-t border-white/30 backdrop-blur-md shrink-0">
         {fileName && (
            <div className="mb-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg flex justify-between items-center">
                <span className="text-xs text-blue-600 truncate max-w-[200px]"><i className="fa-solid fa-file mr-1"></i> {fileName}</span>
                <button onClick={() => {setFileName(null); setAttachment(null);}} className="text-blue-400 hover:text-blue-600"><i className="fa-solid fa-xmark"></i></button>
            </div>
         )}
         <div className="flex gap-2 items-end">
            <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 lg:w-11 lg:h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-paperclip text-lg"></i>
            </button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept=".pdf,.dxf,.txt,image/*" />
            
            <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="输入加工指令..."
                // Use text-base on mobile to prevent iOS zoom (16px), text-sm on desktop
                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-base lg:text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all resize-none h-10 lg:h-11 min-h-[40px] max-h-[100px]"
                rows={1}
            />
            <button 
                onClick={handleSend}
                disabled={isProcessing || (!inputText && !attachment)}
                className={`w-10 h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center text-white transition-all shadow-lg flex-shrink-0 ${isProcessing || (!inputText && !attachment) ? 'bg-slate-300 shadow-none' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-200'}`}
            >
                {isProcessing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-paper-plane text-lg"></i>}
            </button>
         </div>
      </div>
    </div>
  );
};

export default ChatPanel;