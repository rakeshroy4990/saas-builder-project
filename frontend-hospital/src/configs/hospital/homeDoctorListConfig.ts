import type { ComponentDefinition, ContainerConfig } from '../../core/types/ComponentDefinition';

function buildDoctorCardItemTemplate(idPrefix: string): ContainerConfig {
  return {
    layoutTemplate: 'hosp.doctor.card',
    styles: { styleTemplate: 'hosp.doctor.card' },
    click: {
      actionId: 'open-appointment-popup',
      data: {
        doctorId: '{{id}}',
        department: '{{departmentValue}}',
        doctorName: '{{name}}',
        doctorDegree: '{{degree}}'
      }
    },
    rootAttrs: { role: 'button', tabIndex: 0 },
    children: [
      {
        id: `${idPrefix}-doctor-image`,
        type: 'image',
        config: { src: '{{image}}', styles: { styleTemplate: 'hosp.doctor.image' } }
      },
      {
        id: `${idPrefix}-doctor-name`,
        type: 'text',
        config: { text: '{{name}}', styles: { styleTemplate: 'hosp.doctor.name' } }
      },
      {
        id: `${idPrefix}-doctor-speciality`,
        type: 'text',
        config: { text: '{{speciality}}', styles: { styleTemplate: 'hosp.doctor.meta' } }
      },
      {
        id: `${idPrefix}-doctor-degree`,
        type: 'text',
        config: { text: '{{degree}}', styles: { styleTemplate: 'hosp.doctor.meta' } }
      },
      {
        id: `${idPrefix}-doctor-experience`,
        type: 'text',
        config: { text: '{{experience}}', styles: { styleTemplate: 'hosp.doctor.meta' } }
      }
    ]
  };
}

/** Department heading + responsive doctor card grid bound to `HomeContent.doctorsByDepartment`. */
export function buildDoctorsByDepartmentListConfig(options: {
  listId: string;
  idPrefix: string;
}): ComponentDefinition {
  const { listId, idPrefix } = options;
  return {
    id: listId,
    type: 'list',
    config: {
      listStyleTemplate: 'hosp.doctors.byDepartment',
      mapping: { packageName: 'hospital', key: 'HomeContent', property: 'doctorsByDepartment' },
      itemTemplate: {
        layoutTemplate: 'hosp.section.stack',
        styles: { styleTemplate: 'hosp.doctors.departmentSection' },
        children: [
          {
            id: `${idPrefix}-department-heading`,
            type: 'text',
            config: {
              text: '{{departmentLabel}}',
              styles: { styleTemplate: 'hosp.doctors.departmentHeading' }
            }
          },
          {
            id: `${idPrefix}-department-doctors`,
            type: 'list',
            config: {
              listStyleTemplate: 'hosp.doctors.grid',
              contextItemsProperty: 'doctors',
              itemTemplate: buildDoctorCardItemTemplate(`${idPrefix}-dept`)
            }
          }
        ]
      }
    }
  };
}
