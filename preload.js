const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openBlend: (blendPath) => ipcRenderer.invoke('open-blend', blendPath),
    saveStoryboard: (name, data) => ipcRenderer.invoke('save-storyboard', name, data),
    listStoryboards: () => ipcRenderer.invoke('list-storyboards'),
    loadStoryboard: (name) => ipcRenderer.invoke('load-storyboard', name),
});

contextBridge.exposeInMainWorld('webUtils', {
    getPathForFile: (file) => webUtils.getPathForFile(file)
}); 