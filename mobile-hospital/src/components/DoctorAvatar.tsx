import Ionicons from '@expo/vector-icons/Ionicons';
import { USER_SKETCH_IMAGE_DATA_URL } from '@saas-builder/hospital-api-client';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';

type DoctorAvatarProps = {
  profilePic?: string;
  imageUrl: string;
  name: string;
  size?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

function canLoadRemoteImage(profilePic: string, imageUrl: string): boolean {
  if (!profilePic.trim()) return false;
  const url = imageUrl.trim();
  if (!url || url === USER_SKETCH_IMAGE_DATA_URL) return false;
  if (/^data:/i.test(url)) return false;
  return /^https?:\/\//i.test(url);
}

/** Doctor profile photo with a person icon when no image is available (RN cannot render SVG data URLs). */
export function DoctorAvatar({
  profilePic = '',
  imageUrl,
  name,
  size = 72,
  borderRadius = 12,
  style
}: DoctorAvatarProps) {
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [imageUrl, profilePic]);

  const frameStyle = { width: size, height: size, borderRadius };
  const showPlaceholder = loadFailed || !canLoadRemoteImage(profilePic, imageUrl);

  if (showPlaceholder) {
    return (
      <View
        style={[styles.placeholder, frameStyle, style]}
        accessibilityRole="image"
        accessibilityLabel={name}
      >
        <Ionicons name="person" size={Math.round(size * 0.45)} color="#94a3b8" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      style={[styles.image, frameStyle, style]}
      accessibilityLabel={name}
      onError={() => setLoadFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border
  },
  image: {
    backgroundColor: colors.background
  }
});
