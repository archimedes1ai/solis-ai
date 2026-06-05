import { useEffect, useRef, useMemo } from 'react';
import { STATE_COLOURS } from '../utils/constants.js';

function inBrain(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / (rx * 0.9);
  const dy = (y - cy) / (ry * 0.82);
  return dx * dx + (dy > 0 ? dy * 1.12 : dy) * (dy > 0 ? dy * 1.12 : dy) < 1;
}

function makeNodes(n, W, H) {
  const cx = W / 2, cy = H / 2, rx = W * 0.39, ry = H * 0.35;
  const nodes = [];
  let tries = 0;
  while (nodes.length < n && tries++ < 6000) {
    const x = cx + (Math.random() * 2 - 1) * rx * 1.1;
    const y = cy + (Math.random() * 2 - 1) * ry * 1.1;
    if (inBrain(x, y, cx, cy, rx, ry)) {
      nodes.push({ x, y, r: 1.4 + Math.random() * 2, phase: Math.random() * Math.PI * 2, spd: 0.018 + Math.random() * 0.04, bri: 0.4 + Math.random() * 0.6 });
    }
  }
  return nodes;
}

function makeEdges(nodes, maxD) {
  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < maxD) edges.push({ i, j, d, str: 1 - d / maxD });
    }
  }
  return edges;
}

export default function BrainCanvas({ state, meetingMode, wakeArmed, wakeFlash, agentCount }) {
  const canvasRef  = useRef(null);
  const frameRef   = useRef(null);
  const stateRef   = useRef(state);
  const meetRef    = useRef(meetingMode);
  const flashRef   = useRef(wakeFlash);
  const agentsRef  = useRef(agentCount);

  useEffect(() => { stateRef.current = meetingMode ? 'meeting' : state; }, [state, meetingMode]);
  useEffect(() => { meetRef.current  = meetingMode; },                    [meetingMode]);
  useEffect(() => { flashRef.current = wakeFlash; },                      [wakeFlash]);
  useEffect(() => { agentsRef.current = agentCount; },                    [agentCount]);

  const geo = useMemo(() => {
    const W = 500, H = 500;
    const nodes = makeNodes(70, W, H);
    const edges = makeEdges(nodes, 76);
    return { nodes, edges, W, H, cx: W / 2, cy: H / 2 };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { nodes, edges, W, H, cx, cy } = geo;
    const pulses = [];
    let tick = 0;

    function spawnPulse() {
      if (!edges.length) return;
      const e = edges[Math.floor(Math.random() * edges.length)];
      pulses.push({ e, t: 0, spd: 0.007 + Math.random() * 0.013, rev: Math.random() > .5, w: 1.5 + Math.random() * 2, a: 0.55 + Math.random() * 0.45 });
    }

    function frame() {
      tick++;
      const st   = stateRef.current || 'idle';
      const cols = STATE_COLOURS[st] || STATE_COLOURS.idle;
      const col  = cols.primary, glow = cols.glow, ring = cols.ring;

      ctx.clearRect(0, 0, W, H);

      // Background halo
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * .5);
      bg.addColorStop(0, glow); bg.addColorStop(1, 'transparent');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // HUD rings
      [
        { r: W * .494, spd:  0.0028, dl: 8,  dg: 14, lw: .75, a: .3  },
        { r: W * .428, spd: -0.0048, dl: 3,  dg: 6,  lw: .55, a: .22 },
        { r: W * .358, spd:  0.0088, dl: 16, dg: 22, lw: 1.0, a: .42 },
      ].forEach(({ r, spd, dl, dg, lw, a }) => {
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(tick * spd);
        ctx.strokeStyle = ring; ctx.globalAlpha = a; ctx.lineWidth = lw; ctx.setLineDash([dl, dg]);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      });

      // Corner brackets
      const bs = 16, bo = W * .478;
      ctx.globalAlpha = .38; ctx.strokeStyle = col; ctx.lineWidth = 1.1;
      [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx, sy]) => {
        const bx = cx + sx * bo, by = cy + sy * bo;
        ctx.beginPath(); ctx.moveTo(bx, by + sy * bs); ctx.lineTo(bx, by); ctx.lineTo(bx - sx * bs, by); ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // Brain outline
      const rx = W * .39, ry = H * .35;
      ctx.save(); ctx.globalAlpha = .16; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - ry * .86);
      ctx.bezierCurveTo(cx - rx * .28, cy - ry * 1.08, cx - rx * 1.02, cy - ry * .72, cx - rx * 1.01, cy - ry * .04);
      ctx.bezierCurveTo(cx - rx * .99, cy + ry * .58, cx - rx * .52, cy + ry * .84, cx - rx * .08, cy + ry * .87);
      ctx.bezierCurveTo(cx + rx * .08, cy + ry * .94, cx + rx * .08, cy + ry * .94, cx + rx * .08, cy + ry * .87);
      ctx.bezierCurveTo(cx + rx * .52, cy + ry * .84, cx + rx * .99, cy + ry * .58, cx + rx * 1.01, cy - ry * .04);
      ctx.bezierCurveTo(cx + rx * 1.02, cy - ry * .72, cx + rx * .28, cy - ry * 1.08, cx, cy - ry * .86);
      ctx.closePath(); ctx.stroke();
      ctx.globalAlpha = .07; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(cx, cy - ry * .8); ctx.bezierCurveTo(cx - 14, cy - ry * .28, cx + 14, cy + ry * .28, cx, cy + ry * .8); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();

      // Edges
      edges.forEach(({ i, j, str }) => {
        ctx.globalAlpha = str * .11; ctx.strokeStyle = col; ctx.lineWidth = str * .7;
        ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // Spawn pulses
      const rate = st === 'agents' ? 3 : st === 'thinking' ? 2 : 1;
      if (tick % Math.max(1, 9 - rate) === 0 && pulses.length < 28) spawnPulse();

      // Draw pulses
      for (let k = pulses.length - 1; k >= 0; k--) {
        const p = pulses[k];
        p.t += p.spd;
        if (p.t >= 1) { pulses.splice(k, 1); continue; }
        const { i, j } = p.e;
        const n1 = nodes[p.rev ? j : i], n2 = nodes[p.rev ? i : j];
        const px = n1.x + (n2.x - n1.x) * p.t, py = n1.y + (n2.y - n1.y) * p.t;
        const pg = ctx.createRadialGradient(px, py, 0, px, py, p.w * 3.5);
        pg.addColorStop(0, col); pg.addColorStop(1, 'transparent');
        ctx.globalAlpha = p.a * (1 - Math.abs(p.t - .5) * 1.6);
        ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, p.w * 3.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Nodes
      nodes.forEach(n => {
        const pulse = Math.sin(tick * n.spd + n.phase);
        const r = n.r + pulse * .75;
        const ng = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 4.5);
        ng.addColorStop(0, col); ng.addColorStop(1, 'transparent');
        ctx.globalAlpha = n.bri * (.45 + pulse * .28);
        ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(n.x, n.y, r * 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = n.bri; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(n.x, n.y, r * .65, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Centre reticle
      const rr = 21, rot = tick * .011;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
      ctx.strokeStyle = col; ctx.globalAlpha = .5; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
      for (let q = 0; q < 4; q++) {
        const a = (q / 4) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); ctx.lineTo(Math.cos(a) * (rr + 7), Math.sin(a) * (rr + 7)); ctx.stroke();
      }
      ctx.restore();

      // Wake flash
      if (flashRef.current) { ctx.globalAlpha = .22; ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }

      // Agent count label
      const ac = agentsRef.current;
      if (ac > 0) {
        ctx.font = `700 9px "Orbitron", monospace`;
        ctx.fillStyle = col; ctx.globalAlpha = .65; ctx.textAlign = 'center';
        ctx.fillText(`${ac} AGENT${ac > 1 ? 'S' : ''} ACTIVE`, cx, H - 16);
        ctx.textAlign = 'start'; ctx.globalAlpha = 1;
      }

      frameRef.current = requestAnimationFrame(frame);
    }

    frameRef.current = requestAnimationFrame(frame);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  return <canvas ref={canvasRef} width={500} height={500} className="brain-canvas" />;
}
