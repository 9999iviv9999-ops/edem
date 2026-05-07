import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiRequest } from "../api";
import { ProfilePhotoCarousel } from "./ProfilePhotoCarousel";
import { ProfileBadgeChip } from "./ProfileBadgeChip";

type ProfilePayload = {
  profile: {
    id: string;
    name: string;
    age: number;
    city: string;
    description?: string | null;
    photos: string[];
    profileBadge?: string | null;
    inGym?: boolean;
    inGymMinutes?: number;
    inGymAt?: string | null;
    memberships: Array<{ isPrimary: boolean; gym: { id: string; name: string; city: string } }>;
  };
  comments: Array<{
    id: string;
    text: string;
    createdAt: string;
    author: { id: string; name: string; photos: string[] };
  }>;
};

type Props = {
  visible: boolean;
  userId: string | null;
  gymId: string;
  onClose: () => void;
  onProfileRemoved: (userId: string) => void;
  onStartChat: (matchId: string) => void;
};

export function ProfileDetailModal({
  visible,
  userId,
  gymId,
  onClose,
  onProfileRemoved,
  onStartChat
}: Props) {
  const insets = useSafeAreaInsets();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [data, setData] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "like" | "chat" | "block" | "report">("");

  useEffect(() => {
    if (!visible || !userId) {
      setData(null);
      setError("");
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const payload = await apiRequest<ProfilePayload>(`/api/profiles/${userId}`);
        if (active) setData(payload);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Не удалось загрузить анкету");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [visible, userId]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onCloseRef.current();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  async function doLike() {
    if (!userId || !gymId || busy) return;
    setBusy("like");
    setError("");
    try {
      await apiRequest("/api/likes", {
        method: "POST",
        body: { toUserId: userId, gymId }
      });
      onProfileRemoved(userId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось поставить лайк");
    } finally {
      setBusy("");
    }
  }

  async function doChat() {
    if (!userId || !gymId || busy) return;
    setBusy("chat");
    setError("");
    try {
      const match = await apiRequest<{ id: string }>("/api/messages/start", {
        method: "POST",
        body: { toUserId: userId, gymId }
      });
      onProfileRemoved(userId);
      onClose();
      onStartChat(match.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось открыть чат");
    } finally {
      setBusy("");
    }
  }

  async function doBlock() {
    if (!userId || busy) return;
    setBusy("block");
    setError("");
    try {
      await apiRequest("/api/blocks", {
        method: "POST",
        body: { blockedUserId: userId }
      });
      onProfileRemoved(userId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось заблокировать");
    } finally {
      setBusy("");
    }
  }

  async function doReport() {
    if (!userId || busy) return;
    setBusy("report");
    setError("");
    try {
      await apiRequest("/api/reports", {
        method: "POST",
        body: {
          reportedUserId: userId,
          reason: "suspicious_profile",
          details: "quick_report_feed_mobile"
        }
      });
      onProfileRemoved(userId);
      onClose();
    } catch {
      onProfileRemoved(userId);
      onClose();
    } finally {
      setBusy("");
    }
  }

  const profile = data?.profile;
  const photos = profile?.photos?.length ? profile.photos : [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 10) }]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.topBtn}>
            <Ionicons name="close" size={28} color="#c8d8ff" />
          </Pressable>
          <Text style={styles.topTitle}>Анкета</Text>
          <View style={styles.topBtn} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#6f8dff" size="large" />
          </View>
        ) : error && !profile ? (
          <Text style={styles.error}>{error}</Text>
        ) : profile ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <ProfilePhotoCarousel photos={photos} height={300} />
            <Text style={styles.name}>
              {profile.name}, {profile.age}
            </Text>
            <ProfileBadgeChip label={profile.profileBadge} />
            {profile.inGym ? (
              <Text style={styles.inGymNow}>
                {profile.inGymMinutes ? `В зале ${profile.inGymMinutes} мин` : "Сейчас в зале"}
              </Text>
            ) : null}
            <Text style={styles.city}>{profile.city}</Text>
            <Text style={styles.desc}>{profile.description || "Открыт(а) к знакомству и тренировкам."}</Text>
            {profile.memberships?.length ? (
              <View style={styles.gymBox}>
                <Text style={styles.gymLabel}>Залы</Text>
                {profile.memberships.map((m) => (
                  <Text key={m.gym.id} style={styles.gymLine}>
                    {m.gym.name} ({m.gym.city}){m.isPrimary ? " · основной" : ""}
                  </Text>
                ))}
              </View>
            ) : null}

            {data?.comments?.length ? (
              <View style={styles.commentsBox}>
                <Text style={styles.gymLabel}>Комментарии</Text>
                {data.comments.slice(0, 8).map((c) => (
                  <View key={c.id} style={styles.commentRow}>
                    <Text style={styles.commentAuthor}>{c.author.name}</Text>
                    <Text style={styles.commentText}>{c.text}</Text>
                    <Pressable
                      style={styles.commentDeleteBtn}
                      onPress={() => {
                        if (busy) return;
                        setBusy("report");
                        setError("");
                        void (async () => {
                          try {
                            await apiRequest(`/api/profiles/comments/${c.id}`, { method: "DELETE" });
                            setData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    comments: prev.comments.filter((row) => row.id !== c.id)
                                  }
                                : prev
                            );
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "Не удалось удалить комментарий");
                          } finally {
                            setBusy("");
                          }
                        })();
                      }}
                    >
                      <Text style={styles.commentDeleteText}>Удалить</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actionRow}>
              <Pressable
                style={[styles.iconAction, styles.iconHeart]}
                onPress={() => void doLike()}
                disabled={!!busy || !gymId}
              >
                {busy === "like" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="heart" size={28} color="#fff" />
                )}
              </Pressable>
              <Pressable
                style={[styles.iconAction, styles.iconChat]}
                onPress={() => void doChat()}
                disabled={!!busy || !gymId}
              >
                {busy === "chat" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
                )}
              </Pressable>
            </View>

            <View style={styles.secondaryRow}>
              <Pressable style={styles.secondaryBtn} onPress={() => void doBlock()} disabled={!!busy}>
                <Text style={styles.secondaryText}>Заблокировать</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => void doReport()} disabled={!!busy}>
                <Text style={styles.secondaryText}>Пожаловаться</Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: "#090f1a"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#243553"
  },
  topBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    color: "#f4f7ff",
    fontWeight: "800",
    fontSize: 17
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  scroll: {
    paddingBottom: 40
  },
  name: {
    color: "#f4f7ff",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 14,
    paddingHorizontal: 16
  },
  city: {
    color: "#9fb1d7",
    fontSize: 15,
    paddingHorizontal: 16,
    marginTop: 4
  },
  inGymNow: {
    color: "#b5ffd2",
    fontWeight: "700",
    fontSize: 13,
    marginTop: 6,
    paddingHorizontal: 16
  },
  desc: {
    color: "#d6e2ff",
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 16,
    marginTop: 12
  },
  gymBox: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a3f63",
    backgroundColor: "#132138"
  },
  gymLabel: {
    color: "#c8d8ff",
    fontWeight: "700",
    marginBottom: 6
  },
  gymLine: {
    color: "#d6e2ff",
    fontSize: 14,
    marginTop: 4
  },
  commentsBox: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a3f63",
    backgroundColor: "#0f1a2d"
  },
  commentRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#243553"
  },
  commentAuthor: {
    color: "#6f8dff",
    fontWeight: "700",
    fontSize: 13
  },
  commentText: {
    color: "#d6e2ff",
    fontSize: 14,
    marginTop: 2
  },
  commentDeleteBtn: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#5f79ae",
    backgroundColor: "#0f1a2d"
  },
  commentDeleteText: {
    color: "#c8d8ff",
    fontSize: 12,
    fontWeight: "700"
  },
  error: {
    color: "#f3a7a7",
    paddingHorizontal: 16,
    marginTop: 12
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginTop: 24,
    paddingHorizontal: 16
  },
  iconAction: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  iconHeart: {
    backgroundColor: "#e2556d"
  },
  iconChat: {
    backgroundColor: "#314b8c",
    borderWidth: 2,
    borderColor: "#6f8dff"
  },
  secondaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginTop: 24,
    paddingHorizontal: 16
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#5f79ae"
  },
  secondaryText: {
    color: "#c8d8ff",
    fontWeight: "600",
    fontSize: 13
  }
});
