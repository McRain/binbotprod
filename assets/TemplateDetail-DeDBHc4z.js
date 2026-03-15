import{A as e,D as t,E as n,N as r,O as i,Q as a,S as o,_ as s,a as c,b as l,c as u,d,f,g as p,h as ee,i as m,s as h,t as g,v as _,w as v}from"./runtime-core.esm-bundler-8J4_mGIa.js";import{c as y,g as b,h as x,m as te,p as ne,s as re,t as S,u as C}from"./index-C0ynqJ4I.js";import{t as ie}from"./Spinner-DhblYlGl.js";function w(e){let t=document.createElement(`span`);return t.textContent=e,t.innerHTML}function T(e,t,n){let{onClickAdd:r,onDragStart:i}=n;e.innerHTML=`
    <h3 class="rb-sidebar-title">ШАБЛОНЫ</h3>
    <div class="rb-template-list">${Object.entries(t).map(([e,t])=>{let n=w(t.icon||`◆`),r=w(t.title),i=w(t.description||``);return`<div class="rb-template-item" data-template="${w(e)}" draggable="true">
      <span class="rb-template-icon">${n}</span>
      <div class="rb-template-info">
        <span class="rb-template-name">${r}</span>
        <span class="rb-template-desc" title="${i}">${i}</span>
      </div>
      <span class="rb-template-add">+</span>
    </div>`}).join(``)}</div>
  `,e.querySelectorAll(`.rb-template-item`).forEach(e=>{e.addEventListener(`click`,()=>r(e.dataset.template)),e.addEventListener(`dragstart`,t=>{t.dataTransfer.effectAllowed=`copy`,i(e.dataset.template)})})}var E=`// renderer.worker.js — OffscreenCanvas Web Worker for node editor rendering\r
\r
/** @type {OffscreenCanvas} */\r
let canvas = null;\r
/** @type {OffscreenCanvasRenderingContext2D} */\r
let ctx = null;\r
let dpr = 1;\r
let width = 0;\r
let height = 0;\r
\r
// State mirrors from main thread\r
let nodes = [];\r
let connections = [];\r
let dragConnection = null;\r
let hoveredPort = null;\r
let selectedNodeId = null;\r
let panX = 0;\r
let panY = 0;\r
let zoom = 1;\r
\r
// ─── Theme (defaults, can be overridden via init message) ───\r
let THEME = {\r
    bg: '#0d1117',\r
    gridDot: '#21262d',\r
    nodeBg: 'rgba(22, 27, 34, 0.92)',\r
    nodeBgSelected: 'rgba(30, 38, 50, 0.95)',\r
    nodeBorder: '#30363d',\r
    nodeBorderSelected: '#58a6ff',\r
    nodeHeader: 'rgba(88, 166, 255, 0.08)',\r
    nodeTitle: '#e6edf3',\r
    nodeRadius: 10,\r
    portRadius: 6,\r
    portOuterRadius: 8,\r
    portColorOutput: '#a371f7',\r
    portColorInput: '#58a6ff',\r
    portHover: '#ffffff',\r
    portLabel: '#8b949e',\r
    connectionColor: '#58a6ff',\r
    connectionWidth: 2.5,\r
    connectionDragColor: 'rgba(88, 166, 255, 0.5)',\r
    headerHeight: 32,\r
    portSpacing: 28,\r
    portPadding: 14,\r
    nodeMinWidth: 160,\r
    font: '12px "Segoe UI", system-ui, sans-serif',\r
    fontBold: '600 13px "Segoe UI", system-ui, sans-serif',\r
};\r
\r
// Shadow padding for cached bitmaps\r
const SHADOW_PAD = 24;\r
\r
// ─── Node templates — received dynamically from main thread ───\r
let NODE_TEMPLATES = {};\r
\r
// ─── Node shell cache ───\r
/** @type {Map<string, OffscreenCanvas>} */\r
const shellCache = new Map();\r
let cacheBuilt = false;\r
\r
function getNodeDimensions(tpl) {\r
    const w = tpl.width || THEME.nodeMinWidth;\r
    const portCount = Math.max(tpl.inputs.length, tpl.outputs.length, 1);\r
    const h = THEME.headerHeight + portCount * THEME.portSpacing + THEME.portPadding;\r
    return { w, h };\r
}\r
\r
function buildShellCache() {\r
    shellCache.clear();\r
    for (const [key, tpl] of Object.entries(NODE_TEMPLATES)) {\r
        for (let sel = 0; sel <= 1; sel++) {\r
            const cacheKey = key + '_' + sel;\r
            const { w, h } = getNodeDimensions(tpl);\r
            const cw = (w + SHADOW_PAD * 2) * dpr;\r
            const ch = (h + SHADOW_PAD * 2) * dpr;\r
            const oc = new OffscreenCanvas(cw, ch);\r
            const c = oc.getContext('2d');\r
            c.scale(dpr, dpr);\r
\r
            const ox = SHADOW_PAD;\r
            const oy = SHADOW_PAD;\r
            const r = THEME.nodeRadius;\r
            const isSelected = sel === 1;\r
\r
            // Shadow\r
            c.save();\r
            c.shadowColor = 'rgba(0, 0, 0, 0.4)';\r
            c.shadowBlur = 12;\r
            c.shadowOffsetY = 3;\r
            c.beginPath();\r
            _roundRect(c, ox, oy, w, h, r);\r
            c.fillStyle = isSelected ? THEME.nodeBgSelected : THEME.nodeBg;\r
            c.fill();\r
            c.restore();\r
\r
            // Border\r
            c.beginPath();\r
            _roundRect(c, ox, oy, w, h, r);\r
            c.strokeStyle = isSelected ? THEME.nodeBorderSelected : THEME.nodeBorder;\r
            c.lineWidth = isSelected ? 2 : 1;\r
            c.stroke();\r
\r
            // Header clip + fill\r
            c.save();\r
            c.beginPath();\r
            _roundRect(c, ox, oy, w, THEME.headerHeight, r);\r
            c.clip();\r
            c.fillStyle = THEME.nodeHeader;\r
            c.fillRect(ox, oy, w, THEME.headerHeight);\r
            c.restore();\r
\r
            // Header separator\r
            c.beginPath();\r
            c.moveTo(ox, oy + THEME.headerHeight);\r
            c.lineTo(ox + w, oy + THEME.headerHeight);\r
            c.strokeStyle = THEME.nodeBorder;\r
            c.lineWidth = 1;\r
            c.stroke();\r
\r
            // Close button\r
            c.textAlign = 'right';\r
            c.fillStyle = '#484f58';\r
            c.font = '14px sans-serif';\r
            c.textBaseline = 'middle';\r
            c.fillText('\\u2715', ox + w - 10, oy + THEME.headerHeight / 2);\r
\r
            // Input ports + labels\r
            for (let i = 0; i < tpl.inputs.length; i++) {\r
                const py = oy + THEME.headerHeight + THEME.portPadding + i * THEME.portSpacing;\r
                const px = ox;\r
                _drawPort(c, px, py, true, false);\r
                c.font = THEME.font;\r
                c.fillStyle = THEME.portLabel;\r
                c.textAlign = 'left';\r
                c.textBaseline = 'middle';\r
                c.fillText(tpl.inputs[i], px + 14, py);\r
            }\r
\r
            // Output ports + labels\r
            for (let i = 0; i < tpl.outputs.length; i++) {\r
                const py = oy + THEME.headerHeight + THEME.portPadding + i * THEME.portSpacing;\r
                const px = ox + w;\r
                _drawPort(c, px, py, false, false);\r
                c.font = THEME.font;\r
                c.fillStyle = THEME.portLabel;\r
                c.textAlign = 'right';\r
                c.textBaseline = 'middle';\r
                c.fillText(tpl.outputs[i], px - 14, py);\r
            }\r
\r
            shellCache.set(cacheKey, oc);\r
        }\r
    }\r
    cacheBuilt = true;\r
}\r
\r
function _drawPort(c, px, py, isInput, isHovered) {\r
    c.beginPath();\r
    c.arc(px, py, THEME.portOuterRadius, 0, Math.PI * 2);\r
    c.fillStyle = THEME.bg;\r
    c.fill();\r
    c.beginPath();\r
    c.arc(px, py, THEME.portRadius, 0, Math.PI * 2);\r
    c.fillStyle = isHovered ? THEME.portHover : (isInput ? THEME.portColorInput : THEME.portColorOutput);\r
    c.fill();\r
    c.beginPath();\r
    c.arc(px, py, 2.5, 0, Math.PI * 2);\r
    c.fillStyle = THEME.bg;\r
    c.fill();\r
}\r
\r
function _roundRect(c, x, y, w, h, r) {\r
    c.moveTo(x + r, y);\r
    c.lineTo(x + w - r, y);\r
    c.arcTo(x + w, y, x + w, y + h, r);\r
    c.lineTo(x + w, y + h - r);\r
    c.arcTo(x + w, y + h, x, y + h, r);\r
    c.lineTo(x + r, y + h);\r
    c.arcTo(x, y + h, x, y, r);\r
    c.lineTo(x, y + r);\r
    c.arcTo(x, y, x + w, y, r);\r
}\r
\r
// ─── Message handler ───\r
self.onmessage = function (e) {\r
    var msg = e.data;\r
\r
    switch (msg.type) {\r
        case 'init': {\r
            canvas = msg.canvas;\r
            ctx = canvas.getContext('2d');\r
            dpr = msg.dpr || 1;\r
            NODE_TEMPLATES = msg.templates || {};\r
            if (msg.theme) {\r
                THEME = Object.assign({}, THEME, msg.theme);\r
            }\r
            resize(msg.width, msg.height);\r
            buildShellCache();\r
            render();\r
            break;\r
        }\r
        case 'resize': {\r
            resize(msg.width, msg.height);\r
            render();\r
            break;\r
        }\r
        case 'state': {\r
            nodes = msg.nodes || nodes;\r
            connections = msg.connections || connections;\r
            dragConnection = msg.dragConnection !== undefined ? msg.dragConnection : dragConnection;\r
            hoveredPort = msg.hoveredPort !== undefined ? msg.hoveredPort : hoveredPort;\r
            selectedNodeId = msg.selectedNodeId !== undefined ? msg.selectedNodeId : selectedNodeId;\r
            panX = msg.panX !== undefined ? msg.panX : panX;\r
            panY = msg.panY !== undefined ? msg.panY : panY;\r
            zoom = msg.zoom !== undefined ? msg.zoom : zoom;\r
            render();\r
            break;\r
        }\r
        case 'updateTemplates': {\r
            NODE_TEMPLATES = msg.templates || {};\r
            buildShellCache();\r
            render();\r
            break;\r
        }\r
    }\r
};\r
\r
function resize(w, h) {\r
    width = w;\r
    height = h;\r
    canvas.width = w * dpr;\r
    canvas.height = h * dpr;\r
}\r
\r
// ─── Render ───\r
function render() {\r
    if (!ctx || !cacheBuilt) return;\r
    ctx.save();\r
    ctx.scale(dpr, dpr);\r
\r
    ctx.fillStyle = THEME.bg;\r
    ctx.fillRect(0, 0, width, height);\r
\r
    drawGrid();\r
\r
    ctx.translate(panX, panY);\r
    ctx.scale(zoom, zoom);\r
\r
    for (var i = 0; i < connections.length; i++) {\r
        drawConnection(connections[i]);\r
    }\r
\r
    if (dragConnection) {\r
        drawDragConnection();\r
    }\r
\r
    for (var i = 0; i < nodes.length; i++) {\r
        drawNode(nodes[i]);\r
    }\r
\r
    ctx.restore();\r
}\r
\r
// ─── Grid ───\r
function drawGrid() {\r
    var baseSpacing = 24;\r
    var spacing = baseSpacing * zoom;\r
    if (spacing < 6) return;\r
    var dotSize = Math.max(0.4, 0.8 * zoom);\r
    ctx.fillStyle = THEME.gridDot;\r
    ctx.beginPath();\r
    for (var x = (panX % spacing + spacing) % spacing; x < width; x += spacing) {\r
        for (var y = (panY % spacing + spacing) % spacing; y < height; y += spacing) {\r
            ctx.moveTo(x + dotSize, y);\r
            ctx.arc(x, y, dotSize, 0, Math.PI * 2);\r
        }\r
    }\r
    ctx.fill();\r
}\r
\r
// ─── Node drawing (cached) ───\r
function drawNode(node) {\r
    var tplKey = node.templateKey;\r
    var isSelected = node.id === selectedNodeId;\r
    var cacheKey = tplKey + '_' + (isSelected ? 1 : 0);\r
    var cached = shellCache.get(cacheKey);\r
    if (!cached) return;\r
\r
    var tpl = NODE_TEMPLATES[tplKey];\r
    if (!tpl) return;\r
\r
    var dim = getNodeDimensions(tpl);\r
    var w = dim.w;\r
    var x = node.x;\r
    var y = node.y;\r
\r
    ctx.drawImage(\r
        cached,\r
        x - SHADOW_PAD, y - SHADOW_PAD,\r
        (w + SHADOW_PAD * 2),\r
        (dim.h + SHADOW_PAD * 2)\r
    );\r
\r
    // Dynamic: title text\r
    ctx.font = THEME.fontBold;\r
    ctx.fillStyle = THEME.nodeTitle;\r
    ctx.textBaseline = 'middle';\r
    ctx.textAlign = 'left';\r
    ctx.fillText(node.title, x + 12, y + THEME.headerHeight / 2);\r
\r
    // Dynamic: hovered port highlight\r
    if (hoveredPort && hoveredPort.nodeId === node.id) {\r
        var pi = hoveredPort.portIndex;\r
        var px, py;\r
        if (hoveredPort.isInput && tpl.inputs[pi]) {\r
            px = x;\r
            py = y + THEME.headerHeight + THEME.portPadding + pi * THEME.portSpacing;\r
        } else if (!hoveredPort.isInput && tpl.outputs[pi]) {\r
            px = x + w;\r
            py = y + THEME.headerHeight + THEME.portPadding + pi * THEME.portSpacing;\r
        }\r
        if (px !== undefined) {\r
            ctx.beginPath();\r
            ctx.arc(px, py, THEME.portOuterRadius, 0, Math.PI * 2);\r
            ctx.fillStyle = THEME.bg;\r
            ctx.fill();\r
            ctx.beginPath();\r
            ctx.arc(px, py, THEME.portRadius, 0, Math.PI * 2);\r
            ctx.fillStyle = THEME.portHover;\r
            ctx.fill();\r
            ctx.beginPath();\r
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);\r
            ctx.fillStyle = THEME.bg;\r
            ctx.fill();\r
        }\r
    }\r
}\r
\r
// ─── Connections ───\r
function drawConnection(conn) {\r
    var fromNode = null;\r
    var toNode = null;\r
    for (var i = 0; i < nodes.length; i++) {\r
        if (nodes[i].id === conn.fromNodeId) fromNode = nodes[i];\r
        if (nodes[i].id === conn.toNodeId) toNode = nodes[i];\r
    }\r
    if (!fromNode || !toNode) return;\r
\r
    var fromTpl = NODE_TEMPLATES[fromNode.templateKey];\r
    var fw = fromTpl ? fromTpl.width : (fromNode.width || THEME.nodeMinWidth);\r
    var fromX = fromNode.x + fw;\r
    var fromY = fromNode.y + THEME.headerHeight + THEME.portPadding + conn.fromPortIndex * THEME.portSpacing;\r
\r
    var toX = toNode.x;\r
    var toY = toNode.y + THEME.headerHeight + THEME.portPadding + conn.toPortIndex * THEME.portSpacing;\r
\r
    drawBezier(fromX, fromY, toX, toY, THEME.connectionColor, THEME.connectionWidth);\r
}\r
\r
function drawDragConnection() {\r
    var node = null;\r
    for (var i = 0; i < nodes.length; i++) {\r
        if (nodes[i].id === dragConnection.fromNodeId) { node = nodes[i]; break; }\r
    }\r
    if (!node) return;\r
\r
    var tpl = NODE_TEMPLATES[node.templateKey];\r
    var nw = tpl ? tpl.width : (node.width || THEME.nodeMinWidth);\r
    var startX, startY;\r
\r
    if (dragConnection.fromIsInput) {\r
        startX = node.x;\r
        startY = node.y + THEME.headerHeight + THEME.portPadding + dragConnection.fromPortIndex * THEME.portSpacing;\r
    } else {\r
        startX = node.x + nw;\r
        startY = node.y + THEME.headerHeight + THEME.portPadding + dragConnection.fromPortIndex * THEME.portSpacing;\r
    }\r
\r
    var endX = (dragConnection.x - panX) / zoom;\r
    var endY = (dragConnection.y - panY) / zoom;\r
\r
    if (dragConnection.fromIsInput) {\r
        drawBezier(endX, endY, startX, startY, THEME.connectionDragColor, THEME.connectionWidth);\r
    } else {\r
        drawBezier(startX, startY, endX, endY, THEME.connectionDragColor, THEME.connectionWidth);\r
    }\r
}\r
\r
function drawBezier(x1, y1, x2, y2, color, lineWidth) {\r
    var dx = Math.abs(x2 - x1);\r
    var cp = Math.max(dx * 0.5, 50);\r
    ctx.beginPath();\r
    ctx.moveTo(x1, y1);\r
    ctx.bezierCurveTo(x1 + cp, y1, x2 - cp, y2, x2, y2);\r
    ctx.strokeStyle = color;\r
    ctx.lineWidth = lineWidth;\r
    ctx.lineCap = 'round';\r
    ctx.stroke();\r
}\r
`,D=`/* reneos-blocks — scoped component styles */\r
\r
.reneos-blocks {\r
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;\r
  background: #0d1117;\r
  color: #c9d1d9;\r
  display: flex;\r
  flex-direction: column;\r
  width: 100%;\r
  height: 100%;\r
  overflow: hidden;\r
}\r
\r
/* Toolbar */\r
.reneos-blocks .rb-toolbar {\r
  display: flex;\r
  align-items: center;\r
  gap: 16px;\r
  padding: 8px 16px;\r
  background: #161b22;\r
  border-bottom: 1px solid #30363d;\r
  height: 42px;\r
  flex-shrink: 0;\r
}\r
\r
.reneos-blocks .rb-toolbar-title {\r
  color: #58a6ff;\r
  font-size: 14px;\r
  font-weight: 600;\r
}\r
\r
.reneos-blocks .rb-btn-clear {\r
  padding: 4px 14px;\r
  border-radius: 6px;\r
  border: 1px solid #3fb950;\r
  background: transparent;\r
  color: #3fb950;\r
  font-size: 12px;\r
  cursor: pointer;\r
  transition: background 0.2s;\r
}\r
\r
.reneos-blocks .rb-btn-clear:hover {\r
  background: rgba(63, 185, 80, 0.15);\r
}\r
\r
/* Editor layout */\r
.reneos-blocks .rb-editor-wrap {\r
  display: flex;\r
  flex: 1;\r
  overflow: hidden;\r
  position: relative;\r
}\r
\r
.reneos-blocks .rb-canvas-container {\r
  flex: 1;\r
  position: relative;\r
  overflow: hidden;\r
}\r
\r
.reneos-blocks .rb-canvas-container canvas {\r
  display: block;\r
  width: 100%;\r
  height: 100%;\r
  touch-action: none;\r
}\r
\r
/* Sidebar toggle */\r
.reneos-blocks .rb-sidebar-toggle {\r
  position: absolute;\r
  right: 260px;\r
  top: 50%;\r
  transform: translateY(-50%);\r
  z-index: 10;\r
  width: 24px;\r
  height: 48px;\r
  border: 1px solid #30363d;\r
  border-right: none;\r
  border-radius: 6px 0 0 6px;\r
  background: #161b22;\r
  color: #8b949e;\r
  font-size: 12px;\r
  cursor: pointer;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  transition: right 0.25s ease, color 0.15s;\r
  padding: 0;\r
}\r
\r
.reneos-blocks .rb-sidebar-toggle:hover {\r
  color: #e6edf3;\r
}\r
\r
.reneos-blocks .rb-editor-wrap.rb-sidebar-hidden .rb-sidebar-toggle {\r
  right: 0;\r
}\r
\r
/* Sidebar */\r
.reneos-blocks .rb-sidebar {\r
  width: 260px;\r
  flex-shrink: 0;\r
  background: #161b22;\r
  border-left: 1px solid #30363d;\r
  padding: 16px 0;\r
  overflow-y: auto;\r
  transition: margin-right 0.25s ease;\r
}\r
\r
.reneos-blocks .rb-editor-wrap.rb-sidebar-hidden .rb-sidebar {\r
  margin-right: -260px;\r
}\r
\r
.reneos-blocks .rb-sidebar-title {\r
  font-size: 11px;\r
  font-weight: 700;\r
  letter-spacing: 1.5px;\r
  color: #58a6ff;\r
  padding: 0 16px 12px;\r
  margin: 0;\r
}\r
\r
.reneos-blocks .rb-template-list {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 2px;\r
}\r
\r
.reneos-blocks .rb-template-item {\r
  display: flex;\r
  align-items: center;\r
  gap: 12px;\r
  padding: 10px 16px;\r
  cursor: grab;\r
  transition: background 0.15s;\r
  user-select: none;\r
}\r
\r
.reneos-blocks .rb-template-item:hover {\r
  background: rgba(88, 166, 255, 0.08);\r
}\r
\r
.reneos-blocks .rb-template-item:active {\r
  cursor: grabbing;\r
}\r
\r
.reneos-blocks .rb-template-icon {\r
  width: 32px;\r
  height: 32px;\r
  border-radius: 8px;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  flex-shrink: 0;\r
  background: radial-gradient(circle, #1a2a3c 0%, #0d1520 100%);\r
  border: 1px solid #30363d;\r
  font-size: 16px;\r
  line-height: 1;\r
}\r
\r
.reneos-blocks .rb-template-info {\r
  display: flex;\r
  flex-direction: column;\r
  flex: 1;\r
  min-width: 0;\r
}\r
\r
.reneos-blocks .rb-template-name {\r
  font-size: 14px;\r
  font-weight: 600;\r
  color: #e6edf3;\r
}\r
\r
.reneos-blocks .rb-template-desc {\r
  font-size: 11px;\r
  color: #8b949e;\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
\r
.reneos-blocks .rb-template-add {\r
  font-size: 18px;\r
  color: #484f58;\r
  transition: color 0.15s;\r
  flex-shrink: 0;\r
}\r
\r
.reneos-blocks .rb-template-item:hover .rb-template-add {\r
  color: #8b949e;\r
}\r
`,O=32,k=28,A=14,j=12,M=160,N=20,P=.15,F=4,I=!1;function L(){if(I)return;I=!0;let e=document.createElement(`style`);e.setAttribute(`data-reneos-blocks`,``),e.textContent=D,document.head.appendChild(e)}var R=class{constructor(e={}){let{container:t,templates:n,theme:r,initialNodes:i,initialConnections:a,showSidebar:o=!0,showToolbar:s=!0,title:c=`Node Editor`}=e;if(!t)throw Error(`BlockEditor: container element is required`);if(!n||Object.keys(n).length===0)throw Error(`BlockEditor: at least one template is required`);this._container=t,this.templates={};for(let e of Object.keys(n))this.templates[e]={...n[e]};this._theme=r||null,this._showSidebar=o,this._showToolbar=s,this._title=c,this.nodes=[],this.connections=[],this._nextId=1,this.selectedNodeId=null,this._panX=0,this._panY=0,this._zoom=1,this._nodeCounter={},this._isDraggingNode=!1,this._dragNodeOffset={x:0,y:0},this._isPanning=!1,this._panStart={x:0,y:0},this._dragConnection=null,this._hoveredPort=null,this._rafPending=!1,this._dragTemplate=null,this._pinchStartDist=0,this._pinchStartZoom=1,this._pinchMidX=0,this._pinchMidY=0,this._isTouchPanning=!1,this._eventListeners={},this._destroyed=!1,L(),this._buildDOM(),this._initWorker(),this._bindEvents(),this._resizeObserver=new ResizeObserver(()=>{if(this._destroyed)return;let{width:e,height:t}=this._getCanvasSize();this._worker.postMessage({type:`resize`,width:e,height:t}),this._sendState()}),this._resizeObserver.observe(this._canvasContainer),i&&i.length>0&&(this.nodes=i.map(e=>({...e})),this._nextId=Math.max(...this.nodes.map(e=>e.id),0)+1),a&&a.length>0&&(this.connections=a.map(e=>({...e}))),requestAnimationFrame(()=>this._sendState())}on(e,t){return this._eventListeners[e]||(this._eventListeners[e]=[]),this._eventListeners[e].push(t),this}off(e,t){let n=this._eventListeners[e];if(!n)return this;let r=n.indexOf(t);return r>=0&&n.splice(r,1),this}getState(){return{nodes:this.nodes.map(e=>({...e,inputs:[...e.inputs],outputs:[...e.outputs]})),connections:this.connections.map(e=>({...e}))}}setState({nodes:e,connections:t}){e&&(this.nodes=e.map(e=>({...e,inputs:[...e.inputs],outputs:[...e.outputs]})),this._nextId=this.nodes.length>0?Math.max(...this.nodes.map(e=>e.id))+1:1),t&&(this.connections=t.map(e=>({...e}))),this.selectedNodeId=null,this._dragConnection=null,this._hoveredPort=null,this._sendState(),this._emit(`change`,this.getState())}addNode(e,t=0,n=0){let r=this.templates[e];if(!r)return null;this._nodeCounter[e]||(this._nodeCounter[e]=0),this._nodeCounter[e]++;let i=this._nodeCounter[e],a=i>1?` ${String.fromCharCode(64+i)}`:``,o=i===1?`${r.title} A`:`${r.title}${a}`,s={id:this._nextId++,templateKey:e,title:o,inputs:[...r.inputs||[]],outputs:[...r.outputs||[]],width:r.width||M,x:t,y:n};return this.nodes.push(s),this.selectedNodeId=s.id,this._sendState(),this._emit(`node:add`,{...s}),this._emit(`change`,this.getState()),{...s}}removeNode(e){this._removeNode(e)}addConnection(e,t,n,r){if(this.connections.some(i=>i.fromNodeId===e&&i.fromPortIndex===t&&i.toNodeId===n&&i.toPortIndex===r))return!1;this.connections=this.connections.filter(e=>!(e.toNodeId===n&&e.toPortIndex===r));let i={fromNodeId:e,fromPortIndex:t,toNodeId:n,toPortIndex:r};return this.connections.push(i),this._sendState(),this._emit(`connection:add`,{...i}),this._emit(`change`,this.getState()),!0}removeConnection(e,t,n,r){let i=this.connections.length;return this.connections=this.connections.filter(i=>!(i.fromNodeId===e&&i.fromPortIndex===t&&i.toNodeId===n&&i.toPortIndex===r)),this.connections.length===i?!1:(this._sendState(),this._emit(`connection:remove`,{fromNodeId:e,fromPortIndex:t,toNodeId:n,toPortIndex:r}),this._emit(`change`,this.getState()),!0)}clearAll(){this.nodes=[],this.connections=[],this.selectedNodeId=null,this._dragConnection=null,this._hoveredPort=null,this._nextId=1,this._nodeCounter={},this._sendState(),this._emit(`change`,this.getState())}destroy(){this._destroyed=!0,this._resizeObserver.disconnect(),this._worker.terminate(),URL.revokeObjectURL(this._workerUrl),this._abortController.abort(),this._container.innerHTML=``,this._eventListeners={}}_buildDOM(){this._container.innerHTML=``;let e=document.createElement(`div`);if(e.className=`reneos-blocks`,this._showToolbar){let t=document.createElement(`header`);t.className=`rb-toolbar`;let n=document.createElement(`span`);n.className=`rb-toolbar-title`,n.textContent=this._title,t.appendChild(n);let r=document.createElement(`button`);r.className=`rb-btn-clear`,r.textContent=`Clear All`,t.appendChild(r),this._btnClear=r,e.appendChild(t)}let t=document.createElement(`div`);t.className=`rb-editor-wrap`;let n=document.createElement(`div`);n.className=`rb-canvas-container`;let r=document.createElement(`canvas`);if(n.appendChild(r),t.appendChild(n),this._showSidebar){let e=document.createElement(`button`);e.className=`rb-sidebar-toggle`,e.textContent=`◀`,e.title=`Toggle sidebar`,t.appendChild(e),this._sidebarToggle=e;let n=document.createElement(`aside`);n.className=`rb-sidebar`,t.appendChild(n),this._sidebarEl=n,T(n,this.templates,{onClickAdd:e=>{let{width:t,height:n}=this._getCanvasSize(),r=t*.3+Math.random()*t*.3,i=n*.2+Math.random()*n*.4;this._createNodeAtCanvas(e,r,i)},onDragStart:e=>{this._dragTemplate=e}})}e.appendChild(t),this._container.appendChild(e),this._root=e,this._editorWrap=t,this._canvasContainer=n,this._canvasEl=r}_initWorker(){let e=new Blob([E],{type:`text/javascript`});this._workerUrl=URL.createObjectURL(e),this._worker=new Worker(this._workerUrl);let t=this._canvasEl.transferControlToOffscreen();this._dpr=window.devicePixelRatio||1;let{width:n,height:r}=this._getCanvasSize(),i={};for(let[e,t]of Object.entries(this.templates))i[e]={inputs:t.inputs||[],outputs:t.outputs||[],width:t.width||M};this._worker.postMessage({type:`init`,canvas:t,dpr:this._dpr,width:n,height:r,templates:i,theme:this._theme},[t])}_getCanvasSize(){return{width:this._canvasContainer.clientWidth,height:this._canvasContainer.clientHeight}}_sendState(){this._rafPending||this._destroyed||(this._rafPending=!0,requestAnimationFrame(()=>{this._rafPending=!1,!this._destroyed&&this._worker.postMessage({type:`state`,nodes:this.nodes,connections:this.connections,dragConnection:this._dragConnection,hoveredPort:this._hoveredPort,selectedNodeId:this.selectedNodeId,panX:this._panX,panY:this._panY,zoom:this._zoom})}))}_emit(e,t){let n=this._eventListeners[e];if(n)for(let e of n)try{e(t)}catch{}}_createNodeAtCanvas(e,t,n){let r=this.templates[e];if(!r)return null;this._nodeCounter[e]||(this._nodeCounter[e]=0),this._nodeCounter[e]++;let i=this._nodeCounter[e],a=i>1?` ${String.fromCharCode(64+i)}`:``,o=i===1?`${r.title} A`:`${r.title}${a}`,s={id:this._nextId++,templateKey:e,title:o,inputs:[...r.inputs||[]],outputs:[...r.outputs||[]],width:r.width||M,x:(t-this._panX)/this._zoom,y:(n-this._panY)/this._zoom};return this.nodes.push(s),this.selectedNodeId=s.id,this._sendState(),this._emit(`node:add`,{...s}),this._emit(`change`,this.getState()),s}_removeNode(e){this.nodes.find(t=>t.id===e)&&(this.nodes=this.nodes.filter(t=>t.id!==e),this.connections=this.connections.filter(t=>t.fromNodeId!==e&&t.toNodeId!==e),this.selectedNodeId===e&&(this.selectedNodeId=null),this._sendState(),this._emit(`node:remove`,e),this._emit(`change`,this.getState()))}_screenToCanvas(e,t){let n=this._canvasContainer.getBoundingClientRect();return{x:e-n.left,y:t-n.top}}_canvasToWorld(e,t){return{x:(e-this._panX)/this._zoom,y:(t-this._panY)/this._zoom}}_getNodeHeight(e){return O+Math.max(e.inputs?e.inputs.length:0,e.outputs?e.outputs.length:0,1)*k+A}_hitTestPort(e,t){for(let n=this.nodes.length-1;n>=0;n--){let r=this.nodes[n],i=r.width||M;if(r.outputs)for(let n=0;n<r.outputs.length;n++){let a=r.x+i,o=r.y+O+A+n*k;if(Math.hypot(e-a,t-o)<=j)return{nodeId:r.id,portIndex:n,isInput:!1}}if(r.inputs)for(let n=0;n<r.inputs.length;n++){let i=r.x,a=r.y+O+A+n*k;if(Math.hypot(e-i,t-a)<=j)return{nodeId:r.id,portIndex:n,isInput:!0}}}return null}_hitTestNode(e,t){for(let n=this.nodes.length-1;n>=0;n--){let r=this.nodes[n],i=r.width||M,a=this._getNodeHeight(r);if(e>=r.x&&e<=r.x+i&&t>=r.y&&t<=r.y+a)return r}return null}_hitTestCloseButton(e,t,n){let r=n.width||M,i=n.x+r-N,a=n.y;return e>=i&&e<=i+N&&t>=a&&t<=a+O}_tryCompleteConnection(e,t){let n=this._hitTestPort(e,t);if(n&&n.nodeId!==this._dragConnection.fromNodeId&&n.isInput!==this._dragConnection.fromIsInput){let e,t,r,i;if(this._dragConnection.fromIsInput?(r=this._dragConnection.fromNodeId,i=this._dragConnection.fromPortIndex,e=n.nodeId,t=n.portIndex):(e=this._dragConnection.fromNodeId,t=this._dragConnection.fromPortIndex,r=n.nodeId,i=n.portIndex),!this.connections.some(n=>n.fromNodeId===e&&n.fromPortIndex===t&&n.toNodeId===r&&n.toPortIndex===i)){this.connections=this.connections.filter(e=>!(e.toNodeId===r&&e.toPortIndex===i));let n={fromNodeId:e,fromPortIndex:t,toNodeId:r,toPortIndex:i};this.connections.push(n),this._emit(`connection:add`,{...n}),this._emit(`change`,this.getState())}}this._dragConnection=null,this._hoveredPort=null,this._sendState()}_bindEvents(){this._abortController=new AbortController;let e=this._abortController.signal,t=this._canvasContainer;t.addEventListener(`mousedown`,e=>this._onMouseDown(e),{signal:e}),t.addEventListener(`mousemove`,e=>this._onMouseMove(e),{signal:e}),t.addEventListener(`mouseup`,e=>this._onMouseUp(e),{signal:e}),t.addEventListener(`mouseleave`,()=>this._onMouseLeave(),{signal:e}),t.addEventListener(`wheel`,e=>this._onWheel(e),{signal:e,passive:!1}),t.addEventListener(`touchstart`,e=>this._onTouchStart(e),{signal:e,passive:!1}),t.addEventListener(`touchmove`,e=>this._onTouchMove(e),{signal:e,passive:!1}),t.addEventListener(`touchend`,e=>this._onTouchEnd(e),{signal:e,passive:!1}),t.addEventListener(`touchcancel`,()=>this._onTouchCancel(),{signal:e}),t.addEventListener(`dragover`,e=>{e.preventDefault(),e.dataTransfer.dropEffect=`copy`},{signal:e}),t.addEventListener(`drop`,e=>{if(e.preventDefault(),this._dragTemplate){let{x:t,y:n}=this._screenToCanvas(e.clientX,e.clientY);this._createNodeAtCanvas(this._dragTemplate,t,n),this._dragTemplate=null}},{signal:e}),this._btnClear&&this._btnClear.addEventListener(`click`,()=>this.clearAll(),{signal:e}),this._sidebarToggle&&this._sidebarToggle.addEventListener(`click`,()=>{this._editorWrap.classList.toggle(`rb-sidebar-hidden`),this._sidebarToggle.textContent=this._editorWrap.classList.contains(`rb-sidebar-hidden`)?`▶`:`◀`},{signal:e})}_onMouseDown(e){let{x:t,y:n}=this._screenToCanvas(e.clientX,e.clientY),{x:r,y:i}=this._canvasToWorld(t,n),a=this._hitTestPort(r,i);if(a){this._dragConnection={fromNodeId:a.nodeId,fromPortIndex:a.portIndex,fromIsInput:a.isInput,x:t,y:n},this._sendState();return}let o=this._hitTestNode(r,i);if(o){if(this._hitTestCloseButton(r,i,o)){this._removeNode(o.id);return}this.selectedNodeId=o.id,this._isDraggingNode=!0,this._dragNodeOffset.x=r-o.x,this._dragNodeOffset.y=i-o.y;let e=this.nodes.indexOf(o);this.nodes.splice(e,1),this.nodes.push(o),this._sendState();return}this.selectedNodeId=null,this._isPanning=!0,this._panStart.x=e.clientX-this._panX,this._panStart.y=e.clientY-this._panY,this._sendState()}_onMouseMove(e){let{x:t,y:n}=this._screenToCanvas(e.clientX,e.clientY),{x:r,y:i}=this._canvasToWorld(t,n);if(this._dragConnection){this._dragConnection.x=t,this._dragConnection.y=n;let e=this._hitTestPort(r,i);e&&e.nodeId!==this._dragConnection.fromNodeId&&e.isInput!==this._dragConnection.fromIsInput?this._hoveredPort=e:this._hoveredPort=null,this._sendState();return}if(this._isDraggingNode&&this.selectedNodeId!=null){let e=this.nodes.find(e=>e.id===this.selectedNodeId);e&&(e.x=r-this._dragNodeOffset.x,e.y=i-this._dragNodeOffset.y,this._sendState());return}if(this._isPanning){this._panX=e.clientX-this._panStart.x,this._panY=e.clientY-this._panStart.y,this._sendState();return}let a=this._hitTestPort(r,i)||null;(this._hoveredPort?.nodeId!==a?.nodeId||this._hoveredPort?.portIndex!==a?.portIndex||this._hoveredPort?.isInput!==a?.isInput)&&(this._hoveredPort=a,this._sendState())}_onMouseUp(e){if(this._dragConnection){let{x:t,y:n}=this._screenToCanvas(e.clientX,e.clientY),{x:r,y:i}=this._canvasToWorld(t,n);this._tryCompleteConnection(r,i)}this._isDraggingNode=!1,this._isPanning=!1}_onMouseLeave(){this._isDraggingNode=!1,this._isPanning=!1,this._dragConnection&&(this._dragConnection=null,this._hoveredPort=null,this._sendState())}_onWheel(e){e.preventDefault();let{x:t,y:n}=this._screenToCanvas(e.clientX,e.clientY),r=e.deltaY<0?1.1:1/1.1,i=Math.min(F,Math.max(P,this._zoom*r));this._panX=t-(t-this._panX)*(i/this._zoom),this._panY=n-(n-this._panY)*(i/this._zoom),this._zoom=i,this._sendState()}_onTouchStart(e){e.preventDefault();let t=e.touches;if(t.length===2){this._isDraggingNode=!1,this._isTouchPanning=!1,this._pinchStartDist=Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY),this._pinchStartZoom=this._zoom;let e=this._screenToCanvas((t[0].clientX+t[1].clientX)/2,(t[0].clientY+t[1].clientY)/2);this._pinchMidX=e.x,this._pinchMidY=e.y;return}if(t.length===1){let e=t[0],{x:n,y:r}=this._screenToCanvas(e.clientX,e.clientY),{x:i,y:a}=this._canvasToWorld(n,r),o=this._hitTestPort(i,a);if(o){this._dragConnection={fromNodeId:o.nodeId,fromPortIndex:o.portIndex,fromIsInput:o.isInput,x:n,y:r},this._sendState();return}let s=this._hitTestNode(i,a);if(s){if(this._hitTestCloseButton(i,a,s)){this._removeNode(s.id);return}this.selectedNodeId=s.id,this._isDraggingNode=!0,this._isTouchPanning=!1,this._dragNodeOffset.x=i-s.x,this._dragNodeOffset.y=a-s.y;let e=this.nodes.indexOf(s);this.nodes.splice(e,1),this.nodes.push(s),this._sendState();return}this.selectedNodeId=null,this._isTouchPanning=!0,this._panStart.x=e.clientX-this._panX,this._panStart.y=e.clientY-this._panY,this._sendState()}}_onTouchMove(e){e.preventDefault();let t=e.touches;if(t.length===2){let e=Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY),n=Math.min(F,Math.max(P,this._pinchStartZoom*(e/this._pinchStartDist)));this._panX=this._pinchMidX-(this._pinchMidX-this._panX)*(n/this._zoom),this._panY=this._pinchMidY-(this._pinchMidY-this._panY)*(n/this._zoom),this._zoom=n,this._sendState();return}if(t.length===1){let e=t[0],{x:n,y:r}=this._screenToCanvas(e.clientX,e.clientY),{x:i,y:a}=this._canvasToWorld(n,r);if(this._dragConnection){this._dragConnection.x=n,this._dragConnection.y=r;let e=this._hitTestPort(i,a);e&&e.nodeId!==this._dragConnection.fromNodeId&&e.isInput!==this._dragConnection.fromIsInput?this._hoveredPort=e:this._hoveredPort=null,this._sendState();return}if(this._isDraggingNode&&this.selectedNodeId!=null){let e=this.nodes.find(e=>e.id===this.selectedNodeId);e&&(e.x=i-this._dragNodeOffset.x,e.y=a-this._dragNodeOffset.y,this._sendState());return}if(this._isTouchPanning){this._panX=e.clientX-this._panStart.x,this._panY=e.clientY-this._panStart.y,this._sendState();return}}}_onTouchEnd(e){e.preventDefault();let t=e.touches;if(t.length===1){let e=t[0];this._isTouchPanning=!0,this._isDraggingNode=!1,this._dragConnection=null,this._hoveredPort=null,this._panStart.x=e.clientX-this._panX,this._panStart.y=e.clientY-this._panY,this._sendState();return}if(this._dragConnection)if(e.changedTouches.length>0){let t=e.changedTouches[0],{x:n,y:r}=this._screenToCanvas(t.clientX,t.clientY),{x:i,y:a}=this._canvasToWorld(n,r);this._tryCompleteConnection(i,a)}else this._dragConnection=null,this._hoveredPort=null,this._sendState();this._isDraggingNode=!1,this._isTouchPanning=!1}_onTouchCancel(){this._isDraggingNode=!1,this._isTouchPanning=!1,this._dragConnection=null,this._hoveredPort=null,this._sendState()}},z={class:`page`},B={class:`page-header`},V={key:0,class:`template-layout`},H={class:`card info-card`},U={class:`form-group`},W={class:`form-group`},G={key:0,class:`hint`},K={class:`param-info`},q={class:`param-key`},J={class:`param-desc`},ae={class:`param-value`},oe=[`onUpdate:modelValue`],se=[`onUpdate:modelValue`],ce=[`onUpdate:modelValue`],le=[`value`],ue=[`onUpdate:modelValue`],de=[`title`],fe={key:1,class:`form-error`},Y={class:`form-actions`},pe=[`disabled`],me={class:`card builder-card`},he={class:`flow-debug`},X=S({__name:`TemplateDetail`,setup(S){let w=C(),{showSuccess:T,showError:E}=ee(`notify`),D=w.params.id,O=e(!0),k=e(!1),A=e(``),j=e(null),M=e(null),N=null,P=i({name:``,description:``,flow:{nodes:[],edges:[]},params:{}}),F=m(()=>Object.entries(P.params)),I=m(()=>P.flow?.nodes?.length||0);function L(e){let t={};for(let n of e)t[n.key]={title:n.title,inputs:n.inputs||[],outputs:n.outputs||[],width:200,icon:n.icon||``,description:n.description||``};return t}function X(e){return{nodes:e?.nodes||[],connections:e?.edges||[]}}function Z(e){return{nodes:e.nodes||[],edges:e.connections||[]}}function Q(e,t){let n={};for(let e of t)n[e.key]=e;let r={};for(let t of e.nodes||[]){let e=n[t.templateKey];if(!(!e||!e.params?.length))for(let n of e.params){let i=`${t.id}_${n.key}`;r[i]={nodeId:t.id,paramKey:n.key,type:n.type,value:n.default,description:`${e.title}: ${n.description}`,...n.options?{options:n.options}:{}}}}return r}let $=[];async function ge(){let e=await re.list();$=e;let t=L(e);if(await p(),!M.value)return;N=new R({container:M.value,templates:t,title:P.name||`Стратегия`,showSidebar:!0,showToolbar:!0,theme:{bg:`#181c21`,nodeHeader:`#2b3139`,nodeBg:`#1e2329`,nodeBorder:`#2b3139`,connectionColor:`#f0b90b`}});let n=X(P.flow);n.nodes.length>0&&N.setState(n),N.on(`change`,e=>{P.flow=Z(e),P.params=Q(e,$)})}async function _e(){O.value=!0;try{let e=await y.get(D);j.value=e,P.name=e.name,P.description=e.description||``,P.flow=e.flow||{nodes:[],edges:[]},P.params=JSON.parse(JSON.stringify(e.params||{}))}catch(e){E(`Ошибка загрузки: `+e.message)}finally{O.value=!1}}async function ve(){if(A.value=``,!P.name.trim()){A.value=`Укажите название`;return}k.value=!0;try{if(N){let e=N.getState();P.flow=Z(e),P.params=Q(e,$)}j.value=await y.update(D,{name:P.name.trim(),description:P.description.trim(),flow:P.flow,params:P.params}),T(`Шаблон сохранён`)}catch(e){A.value=e.message}finally{k.value=!1}}return _(async()=>{await _e(),await p(),j.value&&await ge()}),s(()=>{N&&=(N.destroy(),null)}),(e,i)=>{let s=v(`router-link`);return l(),u(`div`,z,[c(`div`,B,[c(`h1`,null,a(j.value?.name||`Шаблон`),1),f(s,{to:`/templates`,class:`btn btn--ghost`},{default:n(()=>[...i[2]||=[d(`← К шаблонам`,-1)]]),_:1})]),f(ie,{show:O.value},null,8,[`show`]),!O.value&&j.value?(l(),u(`div`,V,[c(`div`,H,[c(`form`,{onSubmit:b(ve,[`prevent`])},[c(`div`,U,[i[3]||=c(`label`,null,`Название`,-1),t(c(`input`,{"onUpdate:modelValue":i[0]||=e=>P.name=e,type:`text`,required:``,maxlength:`100`},null,512),[[x,P.name]])]),c(`div`,W,[i[4]||=c(`label`,null,`Описание`,-1),t(c(`textarea`,{"onUpdate:modelValue":i[1]||=e=>P.description=e,rows:`3`,maxlength:`500`},null,512),[[x,P.description]])]),i[6]||=c(`h3`,null,`Переопределяемые параметры`,-1),F.value.length?h(``,!0):(l(),u(`p`,G,` Параметры будут добавлены визуальным построителем при создании flow-графа. `)),(l(!0),u(g,null,o(F.value,([e,n])=>(l(),u(`div`,{key:e,class:`param-row`},[c(`div`,K,[c(`span`,q,a(e),1),c(`span`,J,a(n.description),1)]),c(`div`,ae,[n.type===`number`?t((l(),u(`input`,{key:0,"onUpdate:modelValue":t=>P.params[e].value=t,type:`number`,step:`any`},null,8,oe)),[[x,P.params[e].value,void 0,{number:!0}]]):n.type===`boolean`?t((l(),u(`input`,{key:1,"onUpdate:modelValue":t=>P.params[e].value=t,type:`checkbox`},null,8,se)),[[ne,P.params[e].value]]):n.type===`select`?t((l(),u(`select`,{key:2,"onUpdate:modelValue":t=>P.params[e].value=t},[(l(!0),u(g,null,o(n.options,e=>(l(),u(`option`,{key:e,value:e},a(e),9,le))),128))],8,ce)),[[te,P.params[e].value]]):t((l(),u(`input`,{key:3,"onUpdate:modelValue":t=>P.params[e].value=t,type:`text`},null,8,ue)),[[x,P.params[e].value]]),c(`span`,{class:`param-node`,title:`Node: ${n.nodeId}.${n.paramKey}`},` → `+a(n.nodeId),9,de)])]))),128)),A.value?(l(),u(`div`,fe,a(A.value),1)):h(``,!0),c(`div`,Y,[c(`button`,{type:`submit`,class:`btn btn--primary`,disabled:k.value},a(k.value?`Сохранение...`:`Сохранить`),9,pe),f(s,{to:`/bots/create?type=custom&template=${r(D)}`,class:`btn btn--accent`},{default:n(()=>[...i[5]||=[d(` Создать бота из шаблона `,-1)]]),_:1},8,[`to`])])],32)]),c(`div`,me,[i[7]||=c(`h3`,null,`Визуальный построитель`,-1),c(`div`,{ref_key:`editorContainer`,ref:M,class:`editor-container`},null,512),c(`details`,he,[c(`summary`,null,`Flow JSON (`+a(I.value)+` нод)`,1),c(`pre`,null,a(JSON.stringify(P.flow,null,2)),1)])])])):h(``,!0)])}}},[[`__scopeId`,`data-v-2ea93743`]]);export{X as default};