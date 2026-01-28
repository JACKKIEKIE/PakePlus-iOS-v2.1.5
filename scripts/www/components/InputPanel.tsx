import React, { useState, useRef } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { Attachment } from '../services/geminiService';
import { AppMode, ModelOption } from '../types';

interface InputPanelProps {
  onSendMessage: (text: string, attachment: Attachment | null, model: ModelOption, mode: AppMode) => void;
  isProcessing: boolean;
}

const InputPanel: React.FC<InputPanelProps> = ({ onSendMessage, isProcessing }) => {
  const [inputText, setInputText] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [mode, setMode] = useState<AppMode>('GENERATE');
  const [model, setModel] = useState<ModelOption>('gemini-3-flash-preview');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if ((!inputText.trim() && !attachment) || isProcessing) return;
    onSendMessage(inputText, attachment, model, mode);
    setInputText('');
    setAttachment(null);
    setFileName(null);
    setPreviewUrl(null);
  };

  const processSTL = (arrayBuffer: ArrayBuffer, name: string) => {
    try {
      const width = 512;
      const height = 512;
      const scene = new THREE.Scene();
      // Transparent background to let glass blur show through
      scene.background = null; 
      
      const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
      camera.position.set(100, 100, 200);
      
      const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, alpha: true, antialias: true });
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0); // Transparent clear

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(0, 1, 1);
      scene.add(directionalLight);

      const loader = new STLLoader();
      const geometry = loader.parse(arrayBuffer);
      // Dark blue material for contrast on light background
      const material = new THREE.MeshPhongMaterial({ color: 0x2563eb, specular: 0x111111, shininess: 200 });
      const mesh = new THREE.Mesh(geometry, material);
      
      geometry.computeBoundingBox();
      geometry.center();
      
      const boundingBox = geometry.boundingBox!;
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      camera.position.z = maxDim * 2.5;
      camera.lookAt(0, 0, 0);

      scene.add(mesh);
      renderer.render(scene, camera);

      const dataUrl = renderer.domElement.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      
      setAttachment({ data: base64, mimeType: 'image/png', fileName: name });
      setPreviewUrl(dataUrl);
      setFileName(name);

      renderer.dispose();
      geometry.dispose();
      material.dispose();

    } catch (err) {
      console.error("STL Error", err);
      alert("无法处理 STL 文件。");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();

      if (file.name.toLowerCase().endsWith('.stl')) {
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) processSTL(reader.result, file.name);
        };
        reader.readAsArrayBuffer(file);
        return;
      }
      if (file.name.toLowerCase().endsWith('.sldprt')) {
        setAttachment({ data: "", mimeType: 'application/x-solidworks-part', fileName: file.name });
        setPreviewUrl(null);
        return;
      }
      if (file.type === 'application/pdf') {
        reader.onload = () => {
            const result = reader.result as string;
            setAttachment({ data: result.split(',')[1], mimeType: 'application/pdf', fileName: file.name });
            setPreviewUrl(null);
        };
        reader.readAsDataURL(file);
        return;
      }
      if (file.name.toLowerCase().endsWith('.dxf')) {
        reader.onload = () => {
            const utf8Bytes = new TextEncoder().encode(reader.result as string);
            setAttachment({ data: btoa(String.fromCodePoint(...utf8Bytes)), mimeType: 'text/plain', fileName: file.name });
            setPreviewUrl(null);
        };
        reader.readAsText(file);
        return;
      }
      if (file.type.startsWith('image/')) {
        reader.onload = () => {
          const result = reader.result as string;
          setAttachment({ data: result.split(',')[1], mimeType: file.type, fileName: file.name });
          setPreviewUrl(result);
        };
        reader.readAsDataURL(file);
        return;
      }
      alert("不支持的文件格式。");
    }
  };

  return (
    <div className="glass-panel rounded-3xl shadow-xl shadow-slate-200/40 flex flex-col overflow-hidden transition-all duration-300 bg-white/40">
      <div className="p-6 border-b border-white/20 bg-white/30">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-slate-800 tracking-tight">智能助手</h2>
            
            <div className="relative group">
                <select 
                    value={model} 
                    onChange={(e) => setModel(e.target.value as ModelOption)}
                    className="appearance-none bg-white/60 hover:bg-white/80 text-slate-700 text-xs py-1.5 pl-3 pr-8 rounded-lg border border-slate-200/50 outline-none focus:border-blue-500 shadow-sm transition-all cursor-pointer font-medium backdrop-blur-sm"
                >
                    <option value="gemini-3-flash-preview">Gemini 3.0 Flash</option>
                    <option value="gemini-3-pro-preview">Gemini 3.0 Pro</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                </select>
                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
        </div>

        {/* Mode Toggle - Light Mode Style */}
        <div className="bg-slate-100/50 p-1 rounded-xl flex mb-2 relative border border-slate-200/50 backdrop-blur-sm">
            <div 
                className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm border border-black/5 transition-all duration-300 ease-out"
                style={{ 
                    left: '4px', 
                    width: 'calc(50% - 4px)', 
                    transform: mode === 'OPTIMIZE' ? 'translateX(100%)' : 'translateX(0)' 
                }} 
            />
            <button 
                onClick={() => setMode('GENERATE')}
                className={`flex-1 relative z-10 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${mode === 'GENERATE' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <i className="fa-solid fa-wand-magic-sparkles"></i> 生成代码
            </button>
            <button 
                onClick={() => setMode('OPTIMIZE')}
                className={`flex-1 relative z-10 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${mode === 'OPTIMIZE' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <i className="fa-solid fa-bolt"></i> 优化代码
            </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto bg-slate-50/30">
          <div className="flex gap-4">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-md shadow-slate-200/50 ${mode === 'GENERATE' ? 'bg-gradient-to-tr from-blue-600 to-cyan-500' : 'bg-gradient-to-tr from-purple-600 to-pink-500'}`}>
               <i className={`fa-solid ${mode === 'GENERATE' ? 'fa-robot' : 'fa-bolt'} text-white text-xs`}></i>
            </div>
            <div className="bg-white/60 p-4 rounded-2xl rounded-tl-none text-slate-600 text-sm leading-relaxed border border-white/50 shadow-sm backdrop-blur-sm">
              {mode === 'GENERATE' ? (
                  <>
                    <p className="font-semibold text-slate-800 mb-1">准备就绪</p>
                    <p className="opacity-90">请描述您的加工需求，或直接上传图纸 (PDF, DXF, STL)。</p>
                  </>
              ) : (
                  <>
                    <p className="font-semibold text-slate-800 mb-1">优化模式</p>
                    <p className="opacity-90">粘贴 G 代码，AI 将自动优化进给率、转速并添加安全指令。</p>
                  </>
              )}
            </div>
          </div>
      </div>

      {/* Attachment Preview */}
      {fileName && (
        <div className="px-6 py-3 bg-white/40 border-t border-white/20 flex justify-between items-center animate-slide-up backdrop-blur-sm">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/50 border border-slate-200/50 flex items-center justify-center relative group">
                     {previewUrl ? (
                         <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                     ) : (
                         <i className="fa-solid fa-file text-slate-400"></i>
                     )}
                     <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors"></div>
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-800 truncate max-w-[180px]">{fileName}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">{attachment?.mimeType.split('/')[1] || 'FILE'}</span>
                </div>
            </div>
            <button 
                onClick={() => { setAttachment(null); setFileName(null); setPreviewUrl(null); }}
                className="w-6 h-6 rounded-full bg-slate-100/50 hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all"
            >
                <i className="fa-solid fa-xmark text-xs"></i>
            </button>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-white/50 border-t border-white/30 backdrop-blur-md">
        <div className="flex gap-3 items-end">
          {mode === 'GENERATE' && (
              <>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 rounded-full bg-slate-100/50 hover:bg-slate-200/50 text-slate-500 hover:text-slate-800 border border-slate-200/50 flex items-center justify-center transition-all flex-shrink-0 backdrop-blur-sm"
                >
                    <i className="fa-solid fa-plus"></i>
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".png, .jpg, .jpeg, .pdf, .stl, .dxf, .sldprt"
                    onChange={handleFileChange} 
                />
              </>
          )}
          
          <div className="relative flex-1">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                  }
              }}
              placeholder={mode === 'GENERATE' ? "输入指令 (例如: 铣削一个100x100的型腔)..." : "在此粘贴代码..."}
              className={`w-full bg-slate-50/50 hover:bg-white/80 border border-slate-200/50 focus:border-blue-500/50 rounded-2xl py-2.5 px-4 text-slate-800 text-sm focus:outline-none transition-all placeholder-slate-400 resize-none leading-relaxed focus:shadow-md focus:shadow-blue-100/50 backdrop-blur-sm ${fileName ? 'h-[42px]' : 'h-[42px] focus:h-[80px]'}`}
              disabled={isProcessing}
            />
          </div>
          
          <button
            onClick={handleSend}
            disabled={isProcessing || (!inputText && !attachment)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg flex-shrink-0 ${
              isProcessing || (!inputText && !attachment)
                ? 'bg-slate-100/50 text-slate-300 cursor-not-allowed shadow-none'
                : mode === 'GENERATE' 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/30'
            }`}
          >
            {isProcessing ? (
              <i className="fa-solid fa-circle-notch fa-spin text-sm"></i>
            ) : (
              <i className="fa-solid fa-arrow-up text-sm"></i>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InputPanel;