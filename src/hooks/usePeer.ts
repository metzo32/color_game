import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { PeerMessage } from '../types/game';
import { createPeerMessage } from '../utils/peerUtils';

interface UsePeerOptions {
  peerId?: string;        // 호스트인 경우 방 ID를 peer ID로 사용
  onMessage?: (msg: PeerMessage, conn: DataConnection) => void;
  onPeerConnect?: (conn: DataConnection) => void;
  onPeerDisconnect?: (peerId: string) => void;
  onError?: (err: Error) => void;
  // true이면 Peer 인스턴스를 생성하지 않음 (싱글플레이용)
  disabled?: boolean;
}

interface UsePeerReturn {
  peer: Peer | null;
  connections: DataConnection[];
  myPeerId: string | null;
  isReady: boolean;
  isConnected: boolean;
  connectToHost: (hostId: string) => Promise<DataConnection>;
  sendToAll: (type: PeerMessage['type'], payload: unknown) => void;
  sendTo: (conn: DataConnection, type: PeerMessage['type'], payload: unknown) => void;
  destroy: () => void;
}

// 안정적인 STUN/TURN 서버 설정
// 0.peerjs.com 공개 서버는 불안정하므로 ICE 서버를 명시적으로 지정
const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
    ],
  },
};

export function usePeer({
  peerId,
  onMessage,
  onPeerConnect,
  onPeerDisconnect,
  onError,
  disabled = false,
}: UsePeerOptions = {}): UsePeerReturn {
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [connections, setConnections] = useState<DataConnection[]>([]);
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);

  // 콜백 최신 참조 유지
  const onMessageRef = useRef(onMessage);
  const onPeerConnectRef = useRef(onPeerConnect);
  const onPeerDisconnectRef = useRef(onPeerDisconnect);
  const onErrorRef = useRef(onError);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onPeerConnectRef.current = onPeerConnect; }, [onPeerConnect]);
  useEffect(() => { onPeerDisconnectRef.current = onPeerDisconnect; }, [onPeerDisconnect]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // 커넥션 이벤트 등록 헬퍼
  const setupConnection = useCallback((conn: DataConnection) => {
    conn.on('open', () => {
      connectionsRef.current = [...connectionsRef.current, conn];
      setConnections([...connectionsRef.current]);
      onPeerConnectRef.current?.(conn);
    });

    conn.on('data', (data) => {
      onMessageRef.current?.(data as PeerMessage, conn);
    });

    conn.on('close', () => {
      connectionsRef.current = connectionsRef.current.filter((c) => c !== conn);
      setConnections([...connectionsRef.current]);
      onPeerDisconnectRef.current?.(conn.peer);
    });

    conn.on('error', (err) => {
      onErrorRef.current?.(err as Error);
    });
  }, []);

  // Peer 초기화
  // disabled=true (싱글플레이)이면 Peer를 생성하지 않아 불필요한 WebSocket 연결을 방지
  useEffect(() => {
    if (disabled) {
      // 싱글플레이: PeerJS 완전 비활성화
      setIsReady(true);
      return;
    }

    const peer = peerId
      ? new Peer(peerId, PEER_CONFIG)
      : new Peer(PEER_CONFIG);
    peerRef.current = peer;

    peer.on('open', (id) => {
      setMyPeerId(id);
      setIsReady(true);
    });

    // 인바운드 커넥션 (호스트가 게스트 연결 받을 때)
    peer.on('connection', (conn) => {
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      onErrorRef.current?.(err as Error);
    });

    peer.on('disconnected', () => {
      setIsReady(false);
    });

    return () => {
      peer.destroy();
      peerRef.current = null;
      connectionsRef.current = [];
      setConnections([]);
      setIsReady(false);
      setMyPeerId(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerId, disabled]);

  // 호스트에 연결 (게스트용)
  const connectToHost = useCallback(async (hostId: string): Promise<DataConnection> => {
    if (!peerRef.current) throw new Error('Peer가 초기화되지 않았습니다.');
    return new Promise((resolve, reject) => {
      const conn = peerRef.current!.connect(hostId, { reliable: true });
      conn.on('open', () => {
        setupConnection(conn);
        resolve(conn);
      });
      conn.on('error', reject);
    });
  }, [setupConnection]);

  // 전체 브로드캐스트 (싱글플레이 시 myPeerId가 null이므로 no-op)
  const sendToAll = useCallback((type: PeerMessage['type'], payload: unknown) => {
    if (!myPeerId) return;
    const msg = createPeerMessage(type, payload, myPeerId);
    connectionsRef.current.forEach((conn) => {
      if (conn.open) conn.send(msg);
    });
  }, [myPeerId]);

  // 특정 커넥션에 전송
  const sendTo = useCallback((conn: DataConnection, type: PeerMessage['type'], payload: unknown) => {
    if (!myPeerId || !conn.open) return;
    const msg = createPeerMessage(type, payload, myPeerId);
    conn.send(msg);
  }, [myPeerId]);

  const destroy = useCallback(() => {
    peerRef.current?.destroy();
  }, []);

  return {
    peer: peerRef.current,
    connections,
    myPeerId,
    isReady,
    isConnected: connections.length > 0,
    connectToHost,
    sendToAll,
    sendTo,
    destroy,
  };
}
