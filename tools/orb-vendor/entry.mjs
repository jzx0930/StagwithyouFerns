// 打包入口:把官方 thinking-orbs 元件 + React 綁成一支自帶檔,掛到 window.__ORB__
// 由 build.bat 用 esbuild 打包成 ../../vendor/thinking-orbs.js(IIFE、含 React)。
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThinkingOrb } from 'thinking-orbs';

window.__ORB__ = { React: React, createRoot: createRoot, ThinkingOrb: ThinkingOrb };
