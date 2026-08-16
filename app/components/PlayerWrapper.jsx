"use client";

import { usePlayer } from "../context/PlayerContext";
import Player from "./Player";

export default function PlayerWrapper() {
  const { activeSong } = usePlayer();

  if (!activeSong) return null;

  return <Player />;
}