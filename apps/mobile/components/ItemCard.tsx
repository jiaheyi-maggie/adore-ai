import { View, Text, Image, StyleSheet, Pressable, Dimensions } from 'react-native';
import type { WardrobeItem } from '@adore/shared';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = 12;
const CARD_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_PADDING * 2 - CARD_GAP) / 2;

interface ItemCardProps {
  item: WardrobeItem;
  onPress?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  tops: '#E3F2FD',
  bottoms: '#FFF3E0',
  dresses: '#FCE4EC',
  outerwear: '#E8EAF6',
  shoes: '#F3E5F5',
  accessories: '#E0F7FA',
  bags: '#FFF9C4',
  jewelry: '#F9FBE7',
  activewear: '#E8F5E9',
  swimwear: '#E0F2F1',
  sleepwear: '#EDE7F6',
  undergarments: '#FAFAFA',
};

export default function ItemCard({ item, onPress }: ItemCardProps) {
  const imageUrl = item.image_url_clean ?? item.image_url;
  const badgeColor = CATEGORY_COLORS[item.category] ?? '#F5F5F5';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{item.category}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: CARD_GAP,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  imageContainer: {
    width: '100%',
    height: CARD_WIDTH * 1.2,
    backgroundColor: '#f5f5f5',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: '#ccc',
  },
  info: {
    padding: 10,
  },
  name: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    color: '#555',
    textTransform: 'capitalize',
  },
});
