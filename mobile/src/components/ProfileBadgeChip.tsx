import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  label?: string | null;
  style?: StyleProp<ViewStyle>;
};

export function ProfileBadgeChip({ label, style }: Props) {
  const t = (label || "").trim();
  if (!t) return null;
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.text} numberOfLines={1}>
        {t}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c79b38",
    backgroundColor: "#1d1626"
  },
  text: {
    color: "#ffe2a9",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3
  }
});
