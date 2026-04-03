import type { PeerMessage, PeerMessageType } from '../types/game';

// 방 ID 생성 (8자리 영숫자)
export function generateRoomId(): string {
  return `cm-${crypto.randomUUID().substring(0, 8)}`;
}

// 초대 링크 생성
export function generateInviteLink(gameId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/lobby/${gameId}`;
}

// PeerJS 메시지 생성 헬퍼
export function createPeerMessage(
  type: PeerMessageType,
  payload: unknown,
  senderId: string
): PeerMessage {
  return {
    type,
    payload,
    senderId,
    timestamp: Date.now(),
  };
}

// 클립보드에 텍스트 복사
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback: execCommand 방식
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}
