import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { ProfileDetailModal } from "../components/ProfileDetailModal";
import { ProfileBadgeChip } from "../components/ProfileBadgeChip";
import { apiRequest } from "../api";
import { normalizePhotoUrl } from "../lib/photo";

export type IncomingLikeRow = {
  id: string;
  createdAt: string;
  fromUser: {
    id: string;
    name: string;
    age: number;
    photos: string[];
    profileBadge?: string | null;
  };
  gym: { id: string; name: string; city: string };
};

type Props = {
  onStartChat: (matchId: string) => void;
};

export function LikesScreen({ onStartChat }: Props) {
  const [rows, setRows] = useState<IncomingLikeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [detailGymId, setDetailGymId] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await apiRequest<IncomingLikeRow[]>("/api/likes/incoming");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить лайки");
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    void load();
  }

  function openDetail(row: IncomingLikeRow) {
    setDetailGymId(row.gym.id);
    setDetailUserId(row.fromUser.id);
  }

  function closeDetail() {
    setDetailUserId(null);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6f8dff" />}
    >
      <Text style={styles.title}>Лайки</Text>
      <Text style={styles.sub}>Кто лайкнул тебя в твоих залах</Text>

      {loading ? (
        <View style={styles.centerRow}>
          <ActivityIndicator color="#6f8dff" />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !error && rows.length === 0 ? (
        <Text style={styles.empty}>Пока никто не лайкнул. Загляни в ленту и будь активнее.</Text>
      ) : null}

      {rows.map((row) => {
        const photo = normalizePhotoUrl(row.fromUser.photos?.[0]);
        return (
          <Pressable key={row.id} style={styles.card} onPress={() => openDetail(row)}>
            <View style={styles.cardRow}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={22} color="#9fb1d7" />
                </View>
              )}
              <View style={styles.cardBody}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {row.fromUser.name}
                  </Text>
                  <Text style={styles.age}>{row.fromUser.age}</Text>
                  {row.fromUser.profileBadge ? (
                    <ProfileBadgeChip label={row.fromUser.profileBadge} style={styles.badgeChip} />
                  ) : null}
                </View>
                <Text style={styles.gym} numberOfLines={1}>
                  {row.gym.name}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#5f79ae" />
            </View>
          </Pressable>
        );
      })}

      <ProfileDetailModal
        visible={Boolean(detailUserId)}
        userId={detailUserId}
        gymId={detailGymId}
        onClose={closeDetail}
        onProfileRemoved={() => {
          closeDetail();
          void load();
        }}
        onStartChat={(matchId) => {
          closeDetail();
          onStartChat(matchId);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10
  },
  title: {
    color: "#f4f7ff",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 4
  },
  sub: {
    color: "#9fb1d7",
    fontSize: 14,
    marginBottom: 6
  },
  centerRow: {
    paddingVertical: 20,
    alignItems: "center"
  },
  error: {
    color: "#f3a7a7",
    fontSize: 14
  },
  empty: {
    color: "#9fb1d7",
    fontSize: 15,
    lineHeight: 22
  },
  card: {
    borderWidth: 1,
    borderColor: "#2a3f63",
    borderRadius: 12,
    backgroundColor: "#132138",
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#0f1a2d"
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center"
  },
  cardBody: {
    flex: 1,
    minWidth: 0
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  name: {
    color: "#f4f7ff",
    fontWeight: "800",
    fontSize: 16,
    flexShrink: 1
  },
  age: {
    color: "#9fb1d7",
    fontWeight: "700"
  },
  gym: {
    color: "#9fb1d7",
    fontSize: 13,
    marginTop: 4
  },
  badgeChip: {
    marginTop: 0,
    paddingHorizontal: 8,
    paddingVertical: 2
  }
});
