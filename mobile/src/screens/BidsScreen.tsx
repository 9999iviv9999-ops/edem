import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { apiRequest, uploadChatAttachment, type ChatUploadedFile } from "../api";
import { ProfileDetailModal } from "../components/ProfileDetailModal";
import { normalizePhotoUrl } from "../lib/photo";
import { Match, Message } from "../types";

type ThreadRow = {
  id: string;
  peerUserId: string;
  name: string;
  photoUrl?: string;
  preview: string;
  unread: number;
};

type MessagesScreenProps = {
  openMatchId?: string | null;
  onOpenMatchConsumed?: () => void;
  onInboxUpdated?: () => void;
};

const CHAT_FILE_MAX = 12 * 1024 * 1024;

function formatThreadPreview(m?: Message): string {
  if (!m) return "Напиши первым";
  const has = Boolean(m.attachmentUrl || m.attachmentFilename);
  const t = (m.text || "").trim();
  if (has && !t) return `📎 ${m.attachmentFilename || "Файл"}`;
  if (has && t) return `${t.length > 48 ? `${t.slice(0, 48)}…` : t} · 📎`;
  return t || "Сообщение";
}

export function MessagesScreen({ openMatchId = null, onOpenMatchConsumed, onInboxUpdated }: MessagesScreenProps) {
  const onConsumedRef = useRef(onOpenMatchConsumed);
  onConsumedRef.current = onOpenMatchConsumed;
  const onInboxUpdatedRef = useRef(onInboxUpdated);
  onInboxUpdatedRef.current = onInboxUpdated;

  const [matches, setMatches] = useState<Match[]>([]);
  const [myUserId, setMyUserId] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<ChatUploadedFile | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  async function loadMatches() {
    const [me, dialogs] = await Promise.all([
      apiRequest<{ id: string }>("/api/profiles/me"),
      apiRequest<Match[]>("/api/matches")
    ]);
    setMyUserId(me.id);
    setMatches(dialogs);
    if (selectedMatchId && !dialogs.some((d) => d.id === selectedMatchId)) {
      setSelectedMatchId("");
    }
    onInboxUpdatedRef.current?.();
  }

  async function loadMessages(matchId: string) {
    const data = await apiRequest<{ messages: Message[] }>(`/api/messages/${matchId}`);
    setMessages(Array.isArray(data.messages) ? data.messages : []);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await loadMatches();
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Не удалось загрузить диалоги");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!openMatchId) return;
    setSelectedMatchId(openMatchId);
    onConsumedRef.current?.();
  }, [openMatchId]);

  useEffect(() => {
    setPendingAttachment(null);
  }, [selectedMatchId]);

  useEffect(() => {
    if (!selectedMatchId) return;
    let active = true;
    void (async () => {
      try {
        await loadMessages(selectedMatchId);
        if (active) await loadMatches();
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Не удалось загрузить сообщения");
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedMatchId]);

  useEffect(() => {
    if (!selectedMatchId) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setSelectedMatchId("");
      return true;
    });
    return () => sub.remove();
  }, [selectedMatchId]);

  useEffect(() => {
    if (!myUserId) return;
    const id = setInterval(() => {
      void loadMatches().catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, [myUserId]);

  const threads: ThreadRow[] = useMemo(
    () =>
      matches.map((m) => {
        const peer = m.userAId === myUserId ? m.userB : m.userA;
        return {
          id: m.id,
          peerUserId: peer?.id || "",
          name: peer?.name || "Пользователь",
          photoUrl: normalizePhotoUrl(peer?.photos?.[0]),
          preview: formatThreadPreview(m.messages?.[0]),
          unread: m.unreadCount ?? 0
        };
      }),
    [matches, myUserId]
  );

  const selectedThread = useMemo(() => threads.find((t) => t.id === selectedMatchId) ?? null, [threads, selectedMatchId]);
  const selectedMatch = useMemo(() => matches.find((m) => m.id === selectedMatchId) ?? null, [matches, selectedMatchId]);
  const totalUnread = useMemo(() => threads.reduce((a, t) => a + t.unread, 0), [threads]);

  async function onSend() {
    if (!selectedMatchId || (!text.trim() && !pendingAttachment) || uploadBusy) return;
    try {
      setError("");
      await apiRequest("/api/messages", {
        method: "POST",
        body: {
          matchId: selectedMatchId,
          text: text.trim(),
          ...(pendingAttachment
            ? {
                attachmentUrl: pendingAttachment.url,
                attachmentMime: pendingAttachment.mimeType,
                attachmentFilename: pendingAttachment.filename,
                attachmentSize: pendingAttachment.size
              }
            : {})
        }
      });
      setText("");
      setPendingAttachment(null);
      await Promise.all([loadMessages(selectedMatchId), loadMatches()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить сообщение");
    }
  }

  async function pickPhoto() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        setError("Нет доступа к галерее");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.88
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if (a.fileSize && a.fileSize > CHAT_FILE_MAX) {
        setError("Файл больше 12 МБ");
        return;
      }
      const uri = a.uri;
      const mime = a.mimeType || "image/jpeg";
      const name = a.fileName || `photo-${Date.now()}.jpg`;
      setUploadBusy(true);
      setError("");
      const up = await uploadChatAttachment(uri, mime, name);
      setPendingAttachment(up);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить фото");
    } finally {
      setUploadBusy(false);
    }
  }

  async function pickDocument() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets?.[0]) return;
      const f = res.assets[0];
      if (f.size && f.size > CHAT_FILE_MAX) {
        setError("Файл больше 12 МБ");
        return;
      }
      const mime = f.mimeType || "application/octet-stream";
      setUploadBusy(true);
      setError("");
      const up = await uploadChatAttachment(f.uri, mime, f.name || "document");
      setPendingAttachment(up);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить файл");
    } finally {
      setUploadBusy(false);
    }
  }

  function openAttachMenu() {
    Alert.alert("Вложение", undefined, [
      { text: "Отмена", style: "cancel" },
      { text: "Фото", onPress: () => void pickPhoto() },
      { text: "Документ", onPress: () => void pickDocument() }
    ]);
  }

  if (!selectedMatchId) {
    return (
      <View style={styles.flexRoot}>
        <Text style={styles.screenTitle}>Сообщения</Text>
        <Text style={styles.screenSub}>
          {totalUnread > 0 ? `Непрочитанных сообщений: ${totalUnread > 99 ? "99+" : totalUnread}` : "Выбери диалог"}
        </Text>
        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
        <FlatList
          style={styles.threadListFlex}
          data={threads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.threadListPad}
          ItemSeparatorComponent={() => <View style={styles.threadSep} />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.threadRow, pressed && styles.threadRowPressed]}
              onPress={() => {
                setError("");
                setSelectedMatchId(item.id);
              }}
            >
              <View style={styles.threadAvatar}>
                {item.photoUrl ? (
                  <Image source={{ uri: item.photoUrl }} style={styles.threadAvatarImage} resizeMode="cover" />
                ) : (
                  <Text style={styles.threadAvatarText}>{(item.name[0] || "?").toUpperCase()}</Text>
                )}
              </View>
              <View style={styles.threadMid}>
                <Text style={styles.threadName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.threadPreview} numberOfLines={2}>
                  {item.preview}
                </Text>
              </View>
              {item.unread > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unread > 99 ? "99+" : item.unread}</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color="#5f79ae" />
              )}
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.emptyThreads}>Пока нет диалогов</Text>}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flexRoot}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <View style={styles.chatTopBar}>
        <Pressable style={styles.backWrap} onPress={() => setSelectedMatchId("")} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#c8d8ff" />
        </Pressable>
        <Pressable
          style={styles.chatPeerTapArea}
          disabled={!selectedThread?.peerUserId}
          onPress={() => {
            if (selectedThread?.peerUserId) setDetailUserId(selectedThread.peerUserId);
          }}
        >
          <Text style={styles.chatPeerTitle} numberOfLines={1}>
            {selectedThread?.name || "Чат"}
          </Text>
        </Pressable>
        <View style={styles.backWrap} />
      </View>
      {error ? <Text style={styles.errorInline}>{error}</Text> : null}

      <FlatList
        style={styles.msgScroll}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.msgListPad}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        renderItem={({ item: m }) => {
          const own = m.fromUserId === myUserId;
          return (
            <View style={[styles.bubbleRow, own ? styles.bubbleRowOwn : styles.bubbleRowPeer]}>
              <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubblePeer]}>
                <Text style={styles.bubbleText}>{m.text}</Text>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          placeholder="Сообщение..."
          placeholderTextColor="#7f93bd"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
        />
        <Pressable style={[styles.sendFab, !text.trim() && styles.sendFabDisabled]} onPress={() => void onSend()} disabled={!text.trim()}>
          <Ionicons name="send" size={20} color="#f4f7ff" />
        </Pressable>
      </View>
      <ProfileDetailModal
        visible={!!detailUserId}
        userId={detailUserId}
        gymId={selectedMatch?.gym?.id ?? ""}
        onClose={() => setDetailUserId(null)}
        onProfileRemoved={() => {}}
        onStartChat={(matchId) => setSelectedMatchId(matchId)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flexRoot: {
    flex: 1,
    backgroundColor: "#0a1220",
    paddingHorizontal: 12,
    paddingTop: 4
  },
  screenTitle: {
    color: "#f4f7ff",
    fontWeight: "800",
    fontSize: 22,
    marginBottom: 4
  },
  screenSub: {
    color: "#9fb1d7",
    marginBottom: 12
  },
  errorBanner: {
    color: "#f3a7a7",
    marginBottom: 8
  },
  errorInline: {
    color: "#f3a7a7",
    fontSize: 13,
    marginBottom: 6
  },
  threadListFlex: {
    flex: 1,
    minHeight: 120
  },
  threadListPad: {
    flexGrow: 1,
    paddingBottom: 24
  },
  threadSep: {
    height: 1,
    backgroundColor: "#1a2740",
    marginLeft: 68
  },
  threadRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12
  },
  threadRowPressed: {
    opacity: 0.85
  },
  threadAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#314b8c",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  threadAvatarImage: {
    width: "100%",
    height: "100%"
  },
  threadAvatarText: {
    color: "#f4f7ff",
    fontWeight: "800",
    fontSize: 18
  },
  threadMid: {
    flex: 1,
    minWidth: 0
  },
  threadName: {
    color: "#f4f7ff",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 2
  },
  threadPreview: {
    color: "#8ca2cd",
    fontSize: 14
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: "#5877cd",
    alignItems: "center",
    justifyContent: "center"
  },
  unreadText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800"
  },
  emptyThreads: {
    color: "#9fb1d7",
    textAlign: "center",
    marginTop: 32
  },
  chatTopBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8
  },
  backWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  chatPeerTitle: {
    color: "#f4f7ff",
    fontWeight: "800",
    fontSize: 18,
    textAlign: "center"
  },
  chatPeerTapArea: {
    flex: 1
  },
  msgScroll: {
    flex: 1
  },
  msgListPad: {
    paddingBottom: 16,
    paddingTop: 4
  },
  bubbleRow: {
    flexDirection: "row",
    width: "100%"
  },
  bubbleRowOwn: {
    justifyContent: "flex-end"
  },
  bubbleRowPeer: {
    justifyContent: "flex-start"
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  bubbleOwn: {
    backgroundColor: "#314b8c",
    borderBottomRightRadius: 4
  },
  bubblePeer: {
    backgroundColor: "#1a2740",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#2a3f63"
  },
  bubbleText: {
    color: "#f4f7ff",
    fontSize: 16,
    lineHeight: 22
  },
  bubbleAttachImg: {
    width: 220,
    maxWidth: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#0f1a2d"
  },
  bubbleAttachLink: {
    color: "#b8d0ff",
    fontSize: 15,
    fontWeight: "600",
    textDecorationLine: "underline",
    marginBottom: 6
  },
  attachChipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: "#243553",
    backgroundColor: "#0d1524"
  },
  attachChipText: {
    flex: 1,
    color: "#dce9ff",
    fontSize: 14
  },
  attachChipRemove: {
    color: "#c8d8ff",
    fontSize: 22,
    fontWeight: "700",
    paddingHorizontal: 8
  },
  attachFab: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a3f63",
    backgroundColor: "#0f1a2d",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2
  },
  attachFabDisabled: {
    opacity: 0.45
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#243553",
    backgroundColor: "#0a1220"
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#2a3f63",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#f4f7ff",
    backgroundColor: "#0f1a2d",
    fontSize: 16
  },
  sendFab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#5877cd",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2
  },
  sendFabDisabled: {
    opacity: 0.4
  }
});
