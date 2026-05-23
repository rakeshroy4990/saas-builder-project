import { Image, Text, View } from 'react-native';

import type { HomeContentModel } from '@/features/home/homeContent';
import { colors } from '@/theme/colors';
import { sharedStyles } from '@/theme/styles';

type HomeContentSectionsProps = {
  content: HomeContentModel;
};

export function HomeContentSections({ content }: HomeContentSectionsProps) {
  return (
    <>
      <Text style={[sharedStyles.sectionHeading, { marginTop: 8 }]}>{content.sections.doctorsHeading}</Text>
      <Text style={sharedStyles.sectionSubheading}>{content.sections.doctorsSubheading}</Text>
      {content.doctors.map((doctor) => (
        <View key={doctor.name} style={sharedStyles.card}>
          <Image source={{ uri: doctor.imageUrl }} style={sharedStyles.cardImage} accessibilityLabel={doctor.name} />
          <Text style={sharedStyles.cardTitle}>{doctor.name}</Text>
          <Text style={sharedStyles.cardMeta}>{doctor.speciality}</Text>
          <Text style={sharedStyles.cardMeta}>{doctor.degree}</Text>
          <Text style={sharedStyles.cardMeta}>{doctor.experience}</Text>
        </View>
      ))}

      <Text style={sharedStyles.sectionHeading}>{content.sections.servicesHeading}</Text>
      <Text style={sharedStyles.sectionSubheading}>{content.sections.servicesSubheading}</Text>
      {content.services.map((service) => (
        <View key={service.name} style={sharedStyles.card}>
          <Image source={{ uri: service.imageUrl }} style={sharedStyles.cardImage} accessibilityLabel={service.name} />
          <Text style={sharedStyles.cardTitle}>
            {service.icon} {service.name}
          </Text>
          <Text style={sharedStyles.cardBody}>{service.description}</Text>
        </View>
      ))}

      <Text style={sharedStyles.sectionHeading}>{content.sections.highlightsHeading}</Text>
      {content.highlights.map((item) => (
        <View key={item.title} style={[sharedStyles.card, { backgroundColor: colors.surface }]}>
          <Text style={sharedStyles.cardTitle}>{item.title}</Text>
          <Text style={sharedStyles.cardBody}>{item.detail}</Text>
        </View>
      ))}

      <View style={[sharedStyles.card, { marginBottom: 8 }]}>
        <Text style={sharedStyles.sectionHeading}>{content.contact.heading}</Text>
        <Text style={[sharedStyles.cardBody, { marginTop: 8 }]}>{content.contact.whatsapp}</Text>
        <Text style={sharedStyles.cardBody}>{content.contact.email}</Text>
      </View>
    </>
  );
}
