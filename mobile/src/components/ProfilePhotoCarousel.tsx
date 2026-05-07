import { useCallback } from "react";
import { Dimensions, FlatList, Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { normalizePhotoUrl } from "../lib/photo";

const WINDOW_W = Dimensions.get("window").width;

type Props = {
  photos: string[];
  height?: number;
};

export function ProfilePhotoCarousel({ photos, height = 300 }: Props) {
  const list = (photos || []).map((u) => normalizePhotoUrl(u)).filter(Boolean);
  if (!list.length) {
    return (
      <View style={[styles.noPhoto, { height }]}>
        <Ionicons name="person" size={64} color="#5f79ae" />
      </View>
    );
  }

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <Image source={{ uri: item }} style={[styles.photo, { width: WINDOW_W, height }]} resizeMode="cover" />
    ),
    [height]
  );

  return (
    <FlatList
      data={list}
      horizontal
      pagingEnabled
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item, i) => `${item}-${i}`}
      renderItem={renderItem}
      style={[styles.strip, { maxHeight: height }]}
    />
  );
}

const styles = StyleSheet.create({
  strip: { alignSelf: "stretch" },
  photo: { backgroundColor: "#132138" },
  noPhoto: {
    width: WINDOW_W,
    alignSelf: "stretch",
    backgroundColor: "#132138",
    alignItems: "center",
    justifyContent: "center"
  }
});
