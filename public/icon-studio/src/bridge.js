// PrismPress React adapter; Kubai engine remains unmodified.
const PRODUCT_ICONS = {
  prism: ['棱镜', '#7C5CFF'], document: ['文档', '#FF5A5F'], edit: ['编辑', '#7C5CFF'],
  upload: ['上传', '#7C5CFF'], shield: ['盾牌', '#5FAE8A'], image: ['照片', '#FF5A5F'],
  link: ['链接', '#5BA3A8'], preview: ['眼睛', '#7C5CFF'], passport: ['剪贴板', '#7C5CFF'],
  copy: ['复制', '#7C5CFF'], publish: ['分享', '#FF5A5F'], refresh: ['同步', '#5BA3A8'],
  download: ['下载', '#5FAE8A'], palette: ['外观', '#7C5CFF'], phone: ['手机', '#5BA3A8'],
  desktop: ['笔记本', '#7C5CFF'], tag: ['标签', '#C9946A'], book: ['书本', '#FF5A5F'],
  music: ['音乐', '#5BA3A8'], video: ['视频', '#FF5A5F'], chat: ['聊天', '#5FAE8A'],
  idea: ['灯泡', '#C9946A'], chart: ['图表', '#5FAE8A'], formula: ['计算器', '#7C5CFF'],
};
runtime.palette = { colors: [], edges: [] };
let productIconId = 0;
const freeIconIds = [];
window.PrismIcons = {
  mount(host, name, accent) {
    const [label, color] = PRODUCT_ICONS[name];
    const id = freeIconIds.pop() ?? productIconId++;
    runtime.palette.colors[id] = accent || color;
    runtime.palette.edges[id] = accent || color;
    const inst = mountIcon(ICONS.find(icon => icon.name === label), id, host);
    return {
      hover(on) { inst.hover = on ? 1 : 0; go(inst); },
      destroy() {
        cancelAnimationFrame(inst.raf);
        delete runtime.palette.colors[id];
        delete runtime.palette.edges[id];
        host.replaceChildren();
        freeIconIds.push(id);
      }
    };
  }
};
