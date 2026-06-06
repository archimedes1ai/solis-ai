import { useEffect, useRef } from "react";

export default function BrainCanvas({
  isThinking = false,
  wakeArmed = false,
  wakeFlash = false,
  agentCount = 25,
}) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const W = canvas.width;
    const H = canvas.height;
    const CX = W / 2;
    const CY = H / 2;
    const RX = 210;
    const RY = 175;

    // --- Grid offscreen canvas ---
    const gridCanvas = document.createElement("canvas");
    gridCanvas.width = W;
    gridCanvas.height = H;
    const gctx = gridCanvas.getContext("2d");
    gctx.strokeStyle = "#071e2e";
    gctx.lineWidth = 0.4;
    const GRID = 28;
    for (let x = 0; x <= W; x += GRID) {
      gctx.beginPath(); gctx.moveTo(x, 0); gctx.lineTo(x, H); gctx.stroke();
    }
    for (let y = 0; y <= H; y += GRID) {
      gctx.beginPath(); gctx.moveTo(0, y); gctx.lineTo(W, y); gctx.stroke();
    }

    // --- Brain zone test ---
    function inBrain(x, y) {
      const dx = x - CX, dy = y - CY;
      const ry = dy < 0 ? RY * 0.88 : RY * 1.05;
      const rx = RX * (1 - Math.abs(dy) / (RY * 2.8));
      return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) < 1;
    }

    function brainDensity(x, y) {
      const dx = x - CX, dy = y - CY;
      const ry = dy < 0 ? RY * 0.88 : RY * 1.05;
      const rx = RX * (1 - Math.abs(dy) / (RY * 2.8));
      const d = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
      return Math.max(0, 1 - d);
    }

    // --- Create neurons ---
    const COUNT = 52;
    const neurons = [];
    for (let i = 0; i < COUNT; i++) {
      let x, y, attempts = 0;
      do {
        x = CX + (Math.random() - 0.5) * RX * 2.1;
        y = CY + (Math.random() - 0.5) * RY * 2.1;
        attempts++;
      } while (!inBrain(x, y) && attempts < 200);

      const density = brainDensity(x, y);
      const size = 1.2 + density * 2.8 + Math.random() * 1.0;

      neurons.push({
        x, y,
        baseX: x, baseY: y,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        wx: Math.random() * Math.PI * 2,
        wy: Math.random() * Math.PI * 2,
        wxSpeed: 0.004 + Math.random() * 0.006,
        wySpeed: 0.003 + Math.random() * 0.005,
        wAmp: 14 + Math.random() * 22,
        size,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.022 + Math.random() * 0.018,
        opacity: 0.45 + density * 0.45 + Math.random() * 0.1,
        hue: 185 + Math.random() * 25,
      });
    }

    // --- HUD ring state ---
    let ringAngle = 0;
    // --- Flicker state ---
    let flickerVal = 0.65;
    let flickerT = 0;

    function drawFrame(t) {
      ctx.fillStyle = "#030e1c";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(gridCanvas, 0, 0);

      ringAngle = t * 0.0003;
      flickerT += 0.025;
      flickerVal = 0.55 + 0.15 * Math.sin(flickerT) * Math.sin(flickerT * 0.7);

      // --- Update neurons ---
      neurons.forEach(n => {
        n.wx += n.wxSpeed;
        n.wy += n.wySpeed;
        n.x = n.baseX + Math.sin(n.wx) * n.wAmp;
        n.y = n.baseY + Math.cos(n.wy) * n.wAmp * 0.7;
        n.baseX += n.vx * 0.1;
        n.baseY += n.vy * 0.1;
        if (!inBrain(n.x, n.y)) {
          n.baseX += (CX - n.baseX) * 0.003;
          n.baseY += (CY - n.baseY) * 0.003;
        }
        n.vx *= 0.995;
        n.vy *= 0.995;
        n.vx += (Math.random() - 0.5) * 0.025;
        n.vy += (Math.random() - 0.5) * 0.025;
        n.phase += n.pulseSpeed;
      });

      // --- Connections ---
      for (let i = 0; i < neurons.length; i++) {
        for (let j = i + 1; j < neurons.length; j++) {
          const a = neurons[i], b = neurons[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 72) {
            const alpha = (1 - dist / 72) * 0.22;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(0,180,220,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // --- Nebula glow ---
      const nebulaGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, 95);
      const nebulaAlpha = 0.06 + 0.04 * Math.sin(t * 0.001);
      nebulaGrad.addColorStop(0, `rgba(0,180,220,${nebulaAlpha})`);
      nebulaGrad.addColorStop(1, "rgba(0,180,220,0)");
      ctx.beginPath();
      ctx.arc(CX, CY, 95, 0, Math.PI * 2);
      ctx.fillStyle = nebulaGrad;
      ctx.fill();

      // --- Neurons ---
      neurons.forEach(n => {
        const pulse = 0.5 + 0.5 * Math.sin(n.phase);
        const r = n.size * (0.85 + pulse * 0.35);
        const alpha = n.opacity * (0.55 + pulse * 0.45);

        // halo
        const halo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 4.5);
        halo.addColorStop(0, `hsla(${n.hue},100%,70%,${alpha * 0.28})`);
        halo.addColorStop(1, `hsla(${n.hue},100%,70%,0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 4.5, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();

        // core dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${n.hue},100%,78%,${alpha})`;
        ctx.fill();
      });

      // --- Central core ---
      const cPulse = 0.5 + 0.5 * Math.sin(t * 0.04);
      const cR = 4.5 + cPulse * 2;
      const cHalo = ctx.createRadialGradient(CX, CY, 0, CX, CY, 32);
      cHalo.addColorStop(0, `rgba(0,238,255,${0.28 + cPulse * 0.18})`);
      cHalo.addColorStop(1, "rgba(0,238,255,0)");
      ctx.beginPath();
      ctx.arc(CX, CY, 32, 0, Math.PI * 2);
      ctx.fillStyle = cHalo;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(CX, CY, cR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,238,255,${0.88 + cPulse * 0.12})`;
      ctx.fill();

      // --- HUD rings ---
      const rings = [
        { r: 205, dash: [3, 9], speed: 0.08, color: "#0b3d55", lw: 0.5 },
        { r: 162, dash: [55, 18, 8, 18], speed: -0.12, color: "#0d5070", lw: 0.8 },
        { r: 132, dash: [7, 7], speed: 0.18, color: "#156080", lw: 0.5 },
      ];
      rings.forEach(ring => {
        ctx.save();
        ctx.translate(CX, CY);
        ctx.rotate(ringAngle * ring.speed * 10);
        ctx.beginPath();
        ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
        ctx.setLineDash(ring.dash);
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = ring.lw;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      });

      // Wake word armed ring
      if (wakeArmed) {
        const wa = 0.4 + 0.3 * Math.sin(t * 0.005);
        ctx.beginPath();
        ctx.arc(CX, CY, 215, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,255,120,${wa})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Wake flash overlay
      if (wakeFlash) {
        ctx.fillStyle = "rgba(0,238,255,0.08)";
        ctx.fillRect(0, 0, W, H);
      }

      // Thinking pulse
      if (isThinking) {
        const tp = 0.5 + 0.5 * Math.sin(t * 0.006);
        const tHalo = ctx.createRadialGradient(CX, CY, 0, CX, CY, 120);
        tHalo.addColorStop(0, `rgba(0,180,255,${tp * 0.12})`);
        tHalo.addColorStop(1, "rgba(0,180,255,0)");
        ctx.beginPath();
        ctx.arc(CX, CY, 120, 0, Math.PI * 2);
        ctx.fillStyle = tHalo;
        ctx.fill();
      }

      // --- Corner brackets ---
      const bSize = 22, bInset = 28;
      ctx.strokeStyle = "#1a6a8a";
      ctx.lineWidth = 1.2;
      [
        [bInset, bInset, 1, 1],
        [W - bInset, bInset, -1, 1],
        [bInset, H - bInset, 1, -1],
        [W - bInset, H - bInset, -1, -1],
      ].forEach(([x, y, sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(x + sx * bSize, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + sy * bSize);
        ctx.stroke();
      });

      // --- Degree markers ---
      ctx.fillStyle = "#0e5a7a";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.globalAlpha = 0.5;
      ctx.fillText("000°", CX, CY - 168);
      ctx.fillText("180°", CX, CY + 180);
      ctx.textAlign = "right";
      ctx.fillText("270°", CX - 172, CY + 3);
      ctx.textAlign = "left";
      ctx.fillText("090°", CX + 175, CY + 3);
      // tick marks
      ctx.strokeStyle = "#1a7090";
      ctx.lineWidth = 1;
      [[CX, CY - 158, CX, CY - 148],
       [CX, CY + 158, CX, CY + 168],
       [CX - 158, CY, CX - 148, CY],
       [CX + 148, CY, CX + 158, CY]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // --- HUD text ---
      ctx.font = "9px monospace";
      ctx.fillStyle = "#1a8aaa";
      ctx.globalAlpha = flickerVal;
      ctx.textAlign = "left";
      ctx.fillText("SYS: ONLINE", bInset + 8, bInset + 28);
      ctx.fillText(`AGENTS: ${agentCount}`, bInset + 8, bInset + 40);
      ctx.fillText("MODE: ACTIVE", bInset + 8, bInset + 52);
      ctx.textAlign = "right";
      ctx.fillText("NRN: 847ms", W - bInset - 8, bInset + 28);
      ctx.fillText("SIG: 99.2%", W - bInset - 8, bInset + 40);
      ctx.fillText("PWR: FULL", W - bInset - 8, bInset + 52);
      ctx.globalAlpha = 1;

      // --- Bottom label ---
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = "#1a8aaa";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("SOLIS  ·  CONSTRUCTION INTELLIGENCE", CX, H - bInset - 10);
      const lblW = 62;
      ctx.strokeStyle = "#1a8aaa";
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(CX - lblW - 90, H - bInset - 14); ctx.lineTo(CX - lblW - 28, H - bInset - 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(CX + lblW + 28, H - bInset - 14); ctx.lineTo(CX + lblW + 90, H - bInset - 14); ctx.stroke();
      ctx.globalAlpha = 1;

      animRef.current = requestAnimationFrame(drawFrame);
    }

    animRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(animRef.current);
  }, [isThinking, wakeArmed, wakeFlash, agentCount]);

  return (
    <canvas
      ref={canvasRef}
      width={500}
      height={500}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
