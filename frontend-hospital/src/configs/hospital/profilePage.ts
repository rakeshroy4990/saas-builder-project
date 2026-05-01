import type { ConditionConfig } from '../../core/types/ComponentDefinition';
import type { PageConfig } from '../../core/types/PageConfig';
import { hospitalPublicChromeTop, hospitalSiteFooter } from './hospitalPublicChrome';

const profileNavButtonActive = (section: string) => ({
  expression: `String(activeSection ?? '') === '${section}'`,
  mappings: {
    activeSection: { packageName: 'hospital', key: 'ProfilePageUiState', property: 'activeSection' }
  }
});

const profileNavButtonInactive = (section: string) => ({
  expression: `String(activeSection ?? '') !== '${section}'`,
  mappings: {
    activeSection: { packageName: 'hospital', key: 'ProfilePageUiState', property: 'activeSection' }
  }
});

const profileDoctorRoleOnly: ConditionConfig = {
  expression: "String(role ?? '').toUpperCase() === 'DOCTOR'",
  mappings: {
    role: { packageName: 'hospital', key: 'AuthSession', property: 'role' }
  }
};

export const hospitalProfilePage: PageConfig = {
  packageName: 'hospital',
  pageId: 'profile',
  title: 'Profile',
  initializeActions: [{ actionId: 'set-profile-header-active' }, { actionId: 'init-profile-page' }],
  container: {
    layoutTemplate: 'hosp.page.root',
    children: [
      ...hospitalPublicChromeTop,
      {
        id: 'hospital-profile-main',
        type: 'container',
        config: {
          styles: { utilityClasses: 'w-full flex-1 min-h-0 flex flex-col' },
          children: [
            {
              id: 'hospital-profile-inner',
              type: 'container',
              config: {
                styles: { utilityClasses: 'w-full flex-1 min-h-0 px-4 py-6 sm:px-6' },
                children: [
                  {
                    id: 'hospital-profile-content-shell',
                    type: 'container',
                    config: {
                      layout: { type: 'grid', grid: ['grid', 'grid-cols-12', 'gap-4', 'items-start'] },
                      styles: { utilityClasses: 'w-full flex-1 min-h-0' },
                      children: [
                        {
                          id: 'hospital-profile-left-menu',
                          type: 'container',
                          config: {
                            styles: {
                              utilityClasses:
                                'col-span-12 md:col-span-2 rounded-xl border border-slate-200 bg-white p-3 space-y-2'
                            },
                            children: [
                              {
                                id: 'hospital-profile-nav-profile-active',
                                type: 'button',
                                condition: profileNavButtonActive('profile'),
                                config: {
                                  text: 'Profile',
                                  styles: {
                                    utilityClasses:
                                      'w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-800 shadow-sm'
                                  },
                                  click: { actionId: 'set-profile-page-section', data: { section: 'profile' } }
                                }
                              },
                              {
                                id: 'hospital-profile-nav-profile',
                                type: 'button',
                                condition: profileNavButtonInactive('profile'),
                                config: {
                                  text: 'Profile',
                                  styles: {
                                    utilityClasses:
                                      'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50'
                                  },
                                  click: { actionId: 'set-profile-page-section', data: { section: 'profile' } }
                                }
                              },
                              {
                                id: 'hospital-profile-nav-inactive-active',
                                type: 'button',
                                condition: profileNavButtonActive('inactive'),
                                config: {
                                  text: 'Inactive account',
                                  styles: {
                                    utilityClasses:
                                      'w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-800 shadow-sm'
                                  },
                                  click: { actionId: 'set-profile-page-section', data: { section: 'inactive' } }
                                }
                              },
                              {
                                id: 'hospital-profile-nav-inactive',
                                type: 'button',
                                condition: profileNavButtonInactive('inactive'),
                                config: {
                                  text: 'Inactive account',
                                  styles: {
                                    utilityClasses:
                                      'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50'
                                  },
                                  click: { actionId: 'set-profile-page-section', data: { section: 'inactive' } }
                                }
                              }
                            ]
                          }
                        },
                        {
                          id: 'hospital-profile-main-panel',
                          type: 'container',
                          config: {
                            styles: {
                              utilityClasses:
                                'col-span-12 md:col-span-10 rounded-xl border border-slate-200 bg-white p-4 space-y-4'
                            },
                            children: [
                              {
                                id: 'hospital-profile-main-title-row',
                                type: 'container',
                                config: {
                                  layout: {
                                    type: 'flex',
                                    flex: ['flex', 'items-center', 'justify-between', 'gap-3', 'flex-wrap']
                                  },
                                  children: [
                                    {
                                      id: 'hospital-profile-main-title',
                                      type: 'text',
                                      config: {
                                        text: 'Profile',
                                        styles: { styleTemplate: 'hosp.section.heading' }
                                      }
                                    }
                                  ]
                                }
                              },
                              {
                                id: 'hospital-profile-content',
                                type: 'container',
                                config: {
                                  styles: { utilityClasses: 'min-w-0 flex-1 space-y-4' },
                                  children: [
                              {
                                id: 'hospital-profile-panel-profile',
                                type: 'container',
                                condition: profileNavButtonActive('profile'),
                                config: {
                                  layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-4'] },
                                  children: [
                                    {
                                      id: 'hospital-profile-form-heading',
                                      type: 'text',
                                      config: {
                                        text: 'Your details',
                                        styles: { utilityClasses: 'text-lg font-semibold text-slate-900' }
                                      }
                                    },
                                    {
                                      id: 'hospital-profile-grid',
                                      type: 'container',
                                      config: {
                                        layout: { type: 'grid', grid: ['grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-4'] },
                                        children: [
                                          {
                                            id: 'hospital-profile-fn',
                                            type: 'input',
                                            config: {
                                              label: 'First name *',
                                              mapping: { packageName: 'hospital', key: 'ProfileForm', property: 'firstName' },
                                              change: { actionId: 'set-profile-form-field', data: { field: 'firstName' } },
                                              styles: { styleTemplate: 'hosp.form.input' }
                                            }
                                          },
                                          {
                                            id: 'hospital-profile-ln',
                                            type: 'input',
                                            config: {
                                              label: 'Last name *',
                                              mapping: { packageName: 'hospital', key: 'ProfileForm', property: 'lastName' },
                                              change: { actionId: 'set-profile-form-field', data: { field: 'lastName' } },
                                              styles: { styleTemplate: 'hosp.form.input' }
                                            }
                                          },
                                          {
                                            id: 'hospital-profile-email',
                                            type: 'input',
                                            config: {
                                              label: 'Email *',
                                              inputType: 'email',
                                              mapping: { packageName: 'hospital', key: 'ProfileForm', property: 'email' },
                                              change: { actionId: 'set-profile-form-field', data: { field: 'email' } },
                                              styles: { styleTemplate: 'hosp.form.input' }
                                            }
                                          },
                                          {
                                            id: 'hospital-profile-mobile',
                                            type: 'input',
                                            config: {
                                              label: 'Mobile number *',
                                              mapping: {
                                                packageName: 'hospital',
                                                key: 'ProfileForm',
                                                property: 'mobileNumber'
                                              },
                                              change: { actionId: 'set-profile-form-field', data: { field: 'mobileNumber' } },
                                              styles: { styleTemplate: 'hosp.form.input' }
                                            }
                                          },
                                          {
                                            id: 'hospital-profile-gender',
                                            type: 'input',
                                            config: {
                                              label: 'Gender *',
                                              mapping: { packageName: 'hospital', key: 'ProfileForm', property: 'gender' },
                                              change: { actionId: 'set-profile-form-field', data: { field: 'gender' } },
                                              styles: { styleTemplate: 'hosp.form.input' }
                                            }
                                          },
                                          {
                                            id: 'hospital-profile-dept',
                                            type: 'input',
                                            condition: profileDoctorRoleOnly,
                                            config: {
                                              label: 'Department',
                                              mapping: { packageName: 'hospital', key: 'ProfileForm', property: 'department' },
                                              change: { actionId: 'set-profile-form-field', data: { field: 'department' } },
                                              styles: { styleTemplate: 'hosp.form.input' }
                                            }
                                          },
                                          {
                                            id: 'hospital-profile-qualifications',
                                            type: 'input',
                                            condition: profileDoctorRoleOnly,
                                            config: {
                                              label: 'Qualifications *',
                                              mapping: {
                                                packageName: 'hospital',
                                                key: 'ProfileForm',
                                                property: 'qualifications'
                                              },
                                              change: { actionId: 'set-profile-form-field', data: { field: 'qualifications' } },
                                              styles: { styleTemplate: 'hosp.form.input', utilityClasses: 'md:col-span-2' }
                                            }
                                          },
                                          {
                                            id: 'hospital-profile-smc-name',
                                            type: 'input',
                                            condition: profileDoctorRoleOnly,
                                            config: {
                                              label: 'State Medical Council *',
                                              mapping: { packageName: 'hospital', key: 'ProfileForm', property: 'smcName' },
                                              change: { actionId: 'set-profile-form-field', data: { field: 'smcName' } },
                                              styles: { styleTemplate: 'hosp.form.input' }
                                            }
                                          },
                                          {
                                            id: 'hospital-profile-smc-reg',
                                            type: 'input',
                                            condition: profileDoctorRoleOnly,
                                            config: {
                                              label: 'SMC registration number *',
                                              mapping: {
                                                packageName: 'hospital',
                                                key: 'ProfileForm',
                                                property: 'smcRegistrationNumber'
                                              },
                                              change: {
                                                actionId: 'set-profile-form-field',
                                                data: { field: 'smcRegistrationNumber' }
                                              },
                                              styles: { styleTemplate: 'hosp.form.input' }
                                            }
                                          },
                                          {
                                            id: 'hospital-profile-address',
                                            type: 'input',
                                            config: {
                                              label: 'Address *',
                                              inputType: 'textarea',
                                              rows: 3,
                                              mapping: { packageName: 'hospital', key: 'ProfileForm', property: 'address' },
                                              change: { actionId: 'set-profile-form-field', data: { field: 'address' } },
                                              styles: { styleTemplate: 'hosp.form.textarea', utilityClasses: 'md:col-span-2' }
                                            }
                                          }
                                        ]
                                      }
                                    },
                                    {
                                      id: 'hospital-profile-save-err',
                                      type: 'text',
                                      condition: {
                                        expression: 'saveError && String(saveError).trim().length > 0',
                                        mappings: {
                                          saveError: { packageName: 'hospital', key: 'ProfileForm', property: 'saveError' }
                                        }
                                      },
                                      config: {
                                        mapping: { packageName: 'hospital', key: 'ProfileForm', property: 'saveError' },
                                        styles: { styleTemplate: 'hosp.form.errorText' }
                                      }
                                    },
                                    {
                                      id: 'hospital-profile-save-row',
                                      type: 'container',
                                      config: {
                                        layout: { type: 'flex', flex: ['flex', 'justify-end'] },
                                        children: [
                                          {
                                            id: 'hospital-profile-save',
                                            type: 'button',
                                            config: {
                                              text: 'Save',
                                              styles: { styleTemplate: 'hosp.popup.button.primary' },
                                              click: { actionId: 'save-user-profile' }
                                            }
                                          }
                                        ]
                                      }
                                    }
                                  ]
                                }
                              },
                              {
                                id: 'hospital-profile-panel-inactive',
                                type: 'container',
                                condition: profileNavButtonActive('inactive'),
                                config: {
                                  layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-4'] },
                                  children: [
                                    {
                                      id: 'hospital-profile-inactive-heading',
                                      type: 'text',
                                      config: {
                                        text: 'Inactive account',
                                        styles: { utilityClasses: 'text-lg font-semibold text-slate-900' }
                                      }
                                    },
                                    {
                                      id: 'hospital-profile-inactive-copy',
                                      type: 'text',
                                      config: {
                                        text: 'Deactivating will sign you out immediately. You will not be able to log in again until an administrator reactivates your account.',
                                        styles: { utilityClasses: 'text-sm leading-relaxed text-slate-600' }
                                      }
                                    },
                                    {
                                      id: 'hospital-profile-deactivate',
                                      type: 'button',
                                      config: {
                                        text: 'Deactivate my account',
                                        styles: {
                                          utilityClasses:
                                            'self-start rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700'
                                        },
                                        click: { actionId: 'deactivate-user-account' }
                                      }
                                    }
                                  ]
                                }
                              }
                                  ]
                                }
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      },
      hospitalSiteFooter('hospital-profile-footer', 'Agastya Healthcare | Manage your account settings.')
    ]
  }
};
