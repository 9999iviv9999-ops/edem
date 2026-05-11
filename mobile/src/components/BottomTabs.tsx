import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { TabKey } from "../types";

type Props = {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  /** Сумма непрочитанных по всем чатам — бейдж на вкладке «Чаты». */
  messagesUnread?: number;
};

type IconName = ComponentProps<typeof Ionicons>["name"];

const tabs: Array<{ key: TabKey; label: string; icon: IconName; activeIcon: IconName }> = [
  { key: "feed", label: "Лента", icon: "home-outline", activeIcon: "home" },
  { key: "likes", label: "Лайки", icon: "heart-outline", activeIcon: "heart" },
  { key: "messages", label: "Чаты", icon: "chatbubble-ellipses-outline", activeIcon: "chatbubble-ellipses" },
  { key: "trainers", label: "Тренеры", icon: "barbell-outline", activeIcon: "barbell" },
  { key: "profile", label: "Профиль", icon: "person-outline", activeIcon: "person" },
];
const SAFE_BOTTOM = Platform.OS === "android" ? 28 : 14;

export function BottomTabs({ active, onChange, messagesUnread = 0 }: Props) {
  const unread = messagesUnread > 99 ? "99+" : String(messagesUnread);
  return (
    <View style={styles.wrap}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[styles.item, active === tab.key && styles.activeItem]}
        >
          <View style={[styles.iconWrap, active === tab.key && styles.iconWrapActive]}>
            <Ionicons
              name={active === tab.key ? tab.activeIcon : tab.icon}
              size={20}
              color={active === tab.key ? "#f4f7ff" : "#9fb1d7"}
              style={styles.icon}
            />
            {tab.key === "messages" && messagesUnread > 0 ? (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{unread}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.label, active === tab.key && styles.activeLabel]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: "rgba(12, 20, 36, 0.95)",
    borderTopColor: "#2b3f63",
    borderTopWidth: 1,
    paddingVertical: 7,
    paddingBottom: SAFE_BOTTOM,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 2,
  },
  activeItem: {
    backgroundColor: "rgba(111,141,255,0.24)",
    borderRadius: 12,
    marginHorizontal: 4,
  },
  iconWrap: {
    position: "relative",
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: "rgba(111,141,255,0.32)",
    borderWidth: 1,
    borderColor: "rgba(170, 206, 255, 0.88)",
    shadowColor: "#66d7ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 14,
  },
  icon: {
    marginBottom: 0,
  },
  tabBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#e24a4a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#0c1424"
  },
  tabBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  label: {
    color: "#9fb1d7",
    fontWeight: "600",
    fontSize: 10,
  },
  activeLabel: {
    color: "#f4f7ff",
  },
});
