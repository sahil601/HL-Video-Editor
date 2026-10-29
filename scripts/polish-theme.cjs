const fs = require('fs');
const path = require('path');

// 1. Polish PropertiesPanel.tsx
const propsPath = path.join(__dirname, '../src/components/properties/PropertiesPanel.tsx');
let propsContent = fs.readFileSync(propsPath, 'utf8');
propsContent = propsContent.replace(/color:\s*'#f8fafc'/g, "color: 'var(--text-primary)'");
propsContent = propsContent.replace(/color:\s*'#ffffff'/g, "color: 'var(--text-primary)'");
propsContent = propsContent.replace(/var\(--accent-indigo\)/g, 'var(--accent-sage)');
propsContent = propsContent.replace(/<span style={{ color: 'var\(--text-muted\)' }}>Name:<\/span>/g, "<span style={{ color: 'var(--text-secondary)' }}>Name:</span>");
propsContent = propsContent.replace(/<span style={{ color: 'var\(--text-muted\)' }}>Resolution:<\/span>/g, "<span style={{ color: 'var(--text-secondary)' }}>Resolution:</span>");
propsContent = propsContent.replace(/<span style={{ color: 'var\(--text-muted\)' }}>Aspect Ratio:<\/span>/g, "<span style={{ color: 'var(--text-secondary)' }}>Aspect Ratio:</span>");
propsContent = propsContent.replace(/<span style={{ color: 'var\(--text-muted\)' }}>Frame Rate:<\/span>/g, "<span style={{ color: 'var(--text-secondary)' }}>Frame Rate:</span>");
propsContent = propsContent.replace(/<span style={{ color: 'var\(--text-muted\)' }}>Duration:<\/span>/g, "<span style={{ color: 'var(--text-secondary)' }}>Duration:</span>");
fs.writeFileSync(propsPath, propsContent, 'utf8');
console.log('[Polish] PropertiesPanel.tsx updated');

// 2. Polish AutoCutModal.tsx
const autoCutPath = path.join(__dirname, '../src/components/modals/AutoCutModal.tsx');
let autoCutContent = fs.readFileSync(autoCutPath, 'utf8');
autoCutContent = autoCutContent.replace(/color:\s*'#f8fafc'/g, "color: 'var(--text-primary)'");
autoCutContent = autoCutContent.replace(/var\(--accent-indigo\)/g, 'var(--accent-sage)');
fs.writeFileSync(autoCutPath, autoCutContent, 'utf8');
console.log('[Polish] AutoCutModal.tsx updated');

// 3. Polish AutoCaptionsModal.tsx
const autoCaptionsPath = path.join(__dirname, '../src/components/modals/AutoCaptionsModal.tsx');
let autoCaptionsContent = fs.readFileSync(autoCaptionsPath, 'utf8');
autoCaptionsContent = autoCaptionsContent.replace(/color:\s*'#f8fafc'/g, "color: 'var(--text-primary)'");
fs.writeFileSync(autoCaptionsPath, autoCaptionsContent, 'utf8');
console.log('[Polish] AutoCaptionsModal.tsx updated');

// 4. Polish ExportModal.tsx
const exportPath = path.join(__dirname, '../src/components/modals/ExportModal.tsx');
let exportContent = fs.readFileSync(exportPath, 'utf8');
exportContent = exportContent.replace(/<h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', margin: 0 }}>Export Rendered Video<\/h3>/g, "<h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Export Rendered Video</h3>");
exportContent = exportContent.replace(/<span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>/g, "<span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>");
exportContent = exportContent.replace(/<span className="font-mono-time" style={{ color: '#ffffff', fontWeight: 700 }}>{progress}%<\/span>/g, '<span className="font-mono-time" style={{ color: \'var(--text-primary)\', fontWeight: 700 }}>{progress}%</span>');
exportContent = exportContent.replace(/var\(--accent-indigo\)/g, 'var(--accent-sage)');
fs.writeFileSync(exportPath, exportContent, 'utf8');
console.log('[Polish] ExportModal.tsx updated');

// 5. Polish MediaLibrary.tsx
const mediaLibPath = path.join(__dirname, '../src/components/library/MediaLibrary.tsx');
let mediaLibContent = fs.readFileSync(mediaLibPath, 'utf8');
mediaLibContent = mediaLibContent.replace(/var\(--accent-indigo\)/g, 'var(--accent-sage)');
fs.writeFileSync(mediaLibPath, mediaLibContent, 'utf8');
console.log('[Polish] MediaLibrary.tsx updated');

// 6. Polish VoiceOverModal.tsx
const voiceOverPath = path.join(__dirname, '../src/components/modals/VoiceOverModal.tsx');
let voiceOverContent = fs.readFileSync(voiceOverPath, 'utf8');
voiceOverContent = voiceOverContent.replace(/<h3 style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', margin: 0 }}>Record Voice-Over<\/h3>/g, "<h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Record Voice-Over</h3>");
voiceOverContent = voiceOverContent.replace(/<span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>Recorded Take Preview<\/span>/g, "<span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Recorded Take Preview</span>");
voiceOverContent = voiceOverContent.replace(/var\(--accent-indigo\)/g, 'var(--accent-sage)');
fs.writeFileSync(voiceOverPath, voiceOverContent, 'utf8');
console.log('[Polish] VoiceOverModal.tsx updated');
