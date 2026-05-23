import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { AuthGate } from '@/components/AuthGate';
import { LoadingView } from '@/components/LoadingView';
import { fetchBlogPreviews, type BlogPreview } from '@/features/blog/blogApi';
import { sharedStyles } from '@/theme/styles';

export default function BlogTab() {
  const { t } = useTranslation();
  const [items, setItems] = useState<BlogPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await fetchBlogPreviews(12);
    setItems(list);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  return (
    <AuthGate>
      {loading ? (
        <LoadingView />
      ) : (
        <View style={sharedStyles.screenPadded}>
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  void (async () => {
                    setRefreshing(true);
                    await load();
                    setRefreshing(false);
                  })();
                }}
              />
            }
            ListEmptyComponent={<Text style={sharedStyles.subtitle}>{t('blog.empty')}</Text>}
            renderItem={({ item }) => (
              <View style={sharedStyles.card}>
                <Text style={{ fontSize: 17, fontWeight: '600', color: '#0f172a', marginBottom: 6 }}>
                  {item.title}
                </Text>
                <Text style={sharedStyles.subtitle}>{item.summary || t('blog.readMore')}</Text>
              </View>
            )}
          />
        </View>
      )}
    </AuthGate>
  );
}
