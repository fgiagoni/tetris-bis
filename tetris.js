// Minimal, self-contained Tetris implementation for browser canvas.
// Author: generated for fgiagoni/tetris-bis
(() => {
  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30; // pixel size
  const LINES_PER_LEVEL = 10;

  const COLORS = {
    0: '#071422',
    I: '#00f0f0',
    J: '#0000f0',
    L: '#f0a000',
    O: '#f0f000',
    S: '#00f000',
    T: '#a000f0',
    Z: '#f00000'
  };

  const SHAPES = {
    I: [[1,1,1,1]],
    J: [[1,0,0],[1,1,1]],
    L: [[0,0,1],[1,1,1]],
    O: [[1,1],[1,1]],
    S: [[0,1,1],[1,1,0]],
    T: [[0,1,0],[1,1,1]],
    Z: [[1,1,0],[0,1,1]]
  };

  // Utilities
  const rnd = arr => arr[Math.floor(Math.random()*arr.length)];
  const deepClone = v => JSON.parse(JSON.stringify(v));

  // Game state
  const playfield = Array.from({length:ROWS}, () => Array(COLS).fill(0));
  let current = null;
  let next = null;
  let pos = {x:0,y:0};
  let score = 0;
  let level = 1;
  let lines = 0;
  let dropInterval = 1000;
  let lastDrop = 0;
  let running = false;
  let requestId = null;

  // DOM
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('next');
  const nctx = nextCanvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const startBtn = document.getElementById('start');
  const pauseBtn = document.getElementById('pause');

  // Scale canvas for crisp pixel look
  canvas.width = COLS*BLOCK;
  canvas.height = ROWS*BLOCK;
  nextCanvas.width = 4*BLOCK;
  nextCanvas.height = 4*BLOCK;
  ctx.imageSmoothingEnabled = false;
  nctx.imageSmoothingEnabled = false;

  function newPiece(){
    const keys = Object.keys(SHAPES);
    const type = rnd(keys);
    const shape = deepClone(SHAPES[type]);
    return {type, shape};
  }

  function spawn(){
    current = next || newPiece();
    next = newPiece();
    pos.x = Math.floor((COLS - current.shape[0].length)/2);
    pos.y = 0;
    if (collides(current.shape, pos.x, pos.y)){
      gameOver();
    }
  }

  function rotate(shape){
    // transpose + reverse rows
    const h = shape.length, w = shape[0].length;
    const r = Array.from({length:w}, () => Array(h).fill(0));
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) r[x][h-1-y] = shape[y][x];
    return r;
  }

  function collides(shape, x, y){
    for(let sy=0; sy<shape.length; sy++){
      for(let sx=0; sx<shape[0].length; sx++){
        if (!shape[sy][sx]) continue;
        const px = x + sx;
        const py = y + sy;
        if (px < 0 || px >= COLS || py >= ROWS) return true;
        if (py >= 0 && playfield[py][px]) return true;
      }
    }
    return false;
  }

  function merge(shape, x, y, type){
    for(let sy=0; sy<shape.length; sy++){
      for(let sx=0; sx<shape[0].length; sx++){
        if (shape[sy][sx]) {
          const px = x + sx;
          const py = y + sy;
          if (py>=0 && py<ROWS && px>=0 && px<COLS) playfield[py][px] = type;
        }
      }
    }
  }

  function clearLines(){
    let cleared = 0;
    for(let y=ROWS-1;y>=0;y--){
      if (playfield[y].every(c => c !== 0)){
        playfield.splice(y,1);
        playfield.unshift(Array(COLS).fill(0));
        cleared++;
        y++; // recheck same row index after splice
      }
    }
    if (cleared){
      const points = [0,40,100,300,1200]; // standard tetris scoring per lines
      score += (points[cleared] || 0) * level;
      lines += cleared;
      level = Math.floor(lines / LINES_PER_LEVEL) + 1;
      dropInterval = Math.max(100, 1000 - (level-1)*100);
      updateScore();
    }
  }

  function updateScore(){
    scoreEl.textContent = score;
    levelEl.textContent = level;
  }

  function gameOver(){
    running = false;
    cancelAnimationFrame(requestId);
    alert(`Game over! Punteggio: ${score}`);
  }

  function drop(){
    if (!current) return;
    if (!collides(current.shape, pos.x, pos.y+1)){
      pos.y++;
    } else {
      merge(current.shape, pos.x, pos.y, current.type);
      clearLines();
      spawn();
    }
  }

  function hardDrop(){
    while(!collides(current.shape, pos.x, pos.y+1)){
      pos.y++;
      score += 2;
    }
    merge(current.shape, pos.x, pos.y, current.type);
    clearLines();
    spawn();
    updateScore();
  }

  function move(dir){
    const nx = pos.x + dir;
    if (!collides(current.shape, nx, pos.y)) pos.x = nx;
  }

  function rotateCurrent(){
    const r = rotate(current.shape);
    // wall kicks: simple tries
    const kicks = [0, -1, 1, -2, 2];
    for (let k of kicks){
      if (!collides(r, pos.x + k, pos.y)){
        current.shape = r;
        pos.x += k;
        return;
      }
    }
  }

  function drawBlock(ctx, x, y, colorKey){
    const pad = 1;
    const color = COLORS[colorKey] || COLORS[0];
    ctx.fillStyle = color;
    ctx.fillRect(x+pad, y+pad, BLOCK - pad*2, BLOCK - pad*2);
    // subtle inner shading
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x+pad, y+pad, (BLOCK - pad*2), (BLOCK - pad*2)/3);
  }

  function draw(){
    // clear
    ctx.fillStyle = COLORS[0];
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // draw playfield
    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        const c = playfield[y][x];
        if (c) drawBlock(ctx, x*BLOCK, y*BLOCK, c);
      }
    }

    // draw current piece
    if (current){
      for(let sy=0; sy<current.shape.length; sy++){
        for(let sx=0; sx<current.shape[0].length; sx++){
          if (current.shape[sy][sx]){
            const px = (pos.x + sx) * BLOCK;
            const py = (pos.y + sy) * BLOCK;
            drawBlock(ctx, px, py, current.type);
          }
        }
      }
    }

    // grid (optional subtle lines)
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for(let x=0;x<=COLS;x++){
      ctx.beginPath();
      ctx.moveTo(x*BLOCK,0);
      ctx.lineTo(x*BLOCK, ROWS*BLOCK);
      ctx.stroke();
    }
    for(let y=0;y<=ROWS;y++){
      ctx.beginPath();
      ctx.moveTo(0,y*BLOCK);
      ctx.lineTo(COLS*BLOCK, y*BLOCK);
      ctx.stroke();
    }

    // draw next
    nctx.fillStyle = COLORS[0];
    nctx.fillRect(0,0,nextCanvas.width,nextCanvas.height);
    if (next){
      const shape = next.shape;
      const w = shape[0].length;
      const h = shape.length;
      const offsetX = Math.floor((4 - w)/2);
      const offsetY = Math.floor((4 - h)/2);
      for(let y=0;y<h;y++){
        for(let x=0;x<w;x++){
          if (shape[y][x]) drawBlock(nctx, (x+offsetX)*BLOCK, (y+offsetY)*BLOCK, next.type);
        }
      }
    }
  }

  function loop(time){
    if (!running) return;
    if (!lastDrop) lastDrop = time;
    const delta = time - lastDrop;
    if (delta > dropInterval){
      drop();
      lastDrop = time;
    }
    draw();
    requestId = requestAnimationFrame(loop);
  }

  // Input
  document.addEventListener('keydown', e => {
    if (!running) return;
    switch(e.code){
      case 'ArrowLeft': e.preventDefault(); move(-1); break;
      case 'ArrowRight': e.preventDefault(); move(1); break;
      case 'ArrowDown': e.preventDefault(); drop(); score+=1; updateScore(); break;
      case 'ArrowUp': e.preventDefault(); rotateCurrent(); break;
      case 'Space': e.preventDefault(); hardDrop(); break;
      case 'KeyP': e.preventDefault(); togglePause(); break;
    }
    draw();
  });

  startBtn.addEventListener('click', () => {
    startGame();
  });

  pauseBtn.addEventListener('click', () => {
    togglePause();
  });

  function startGame(){
    // reset state
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) playfield[y][x] = 0;
    score = 0; level = 1; lines = 0; dropInterval = 1000;
    updateScore();
    next = newPiece();
    spawn();
    running = true;
    lastDrop = 0;
    cancelAnimationFrame(requestId);
    requestId = requestAnimationFrame(loop);
  }

  function togglePause(){
    running = !running;
    if (running) {
      lastDrop = 0;
      requestId = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(requestId);
    }
  }

  // auto-start a new game on load
  window.addEventListener('load', () => {
    // small intro frame
    draw();
  });

  // expose simple API for debugging
  window.tetris = {
    startGame, togglePause, getState: () => ({score,level,lines})
  };
})();
