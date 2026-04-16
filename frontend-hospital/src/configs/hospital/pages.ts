import type { PageConfig } from '../../core/types/PageConfig';

const todayDateInputValue = new Date().toISOString().split('T')[0] ?? '';

export const hospitalPages: PageConfig[] = [
  {
    packageName: 'hospital',
    pageId: 'home',
    title: 'Little Sprouts Care Hospital',
    initializeActions: [{ actionId: 'load-home-content' }, { actionId: 'load-doctors' }],
    container: {
      layoutTemplate: 'hosp.page.root',
      children: [
        {
          id: 'hospital-home-header',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.header.shell',
            styles: { styleTemplate: 'hosp.header.card' },
            children: [
              {
                id: 'hospital-home-header-brand',
                type: 'container',
                config: {
                  layoutTemplate: 'hosp.header.brand',
                  children: [
                    {
                      id: 'hospital-home-header-logo',
                      type: 'image',
                      config: {
                        src: 'https://res.cloudinary.com/dbke33vfd/image/upload/v1776158879/stetho_n1bp0a.jpg',
                        alt: 'Little Sprouts Care logo',
                        styles: { styleTemplate: 'hosp.header.logo' }
                      }
                    },
                    {
                      id: 'hospital-home-header-title',
                      type: 'text',
                      config: { text: 'Little Sprouts Care', styles: { styleTemplate: 'hosp.header.title' } }
                    }
                  ]
                }
              },
              {
                id: 'hospital-home-header-nav',
                type: 'container',
                config: {
                  layoutTemplate: 'hosp.header.nav',
                  children: [
                    {
                      id: 'hospital-home-header-nav-home',
                      type: 'button',
                      config: {
                        text: 'Services',
                        styles: { styleTemplate: 'hosp.header.menuButton' },
                        click: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'home' } }
                      }
                    },
                    // {
                    //   id: 'hospital-home-header-nav-doctors',
                    //   type: 'button',
                    //   config: {
                    //     text: 'Doctors',
                    //     styles: { styleTemplate: 'hosp.header.menuButton' },
                    //     click: {
                    //       actionType: 'navigate',
                    //       navigate: { packageName: 'hospital', pageId: 'doctor-overview' }
                    //     }
                    //   }
                    // },
                    {
                      id: 'hospital-home-header-nav-dashboard',
                      type: 'button',
                      config: {
                        text: 'Contact',
                        styles: { styleTemplate: 'hosp.header.menuButton' },
                        click: {
                          actionType: 'navigate',
                          navigate: { packageName: 'hospital', pageId: 'patient-dashboard' }
                        }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-home-header-actions',
                type: 'container',
                config: {
                  layoutTemplate: 'hosp.header.actions',
                  children: [
                    {
                      id: 'hospital-home-header-login',
                      type: 'button',
                      condition: {
                        expression: "!userId || String(userId).trim().length === 0",
                        mappings: {
                          userId: {
                            packageName: 'hospital',
                            key: 'AuthSession',
                            property: 'userId'
                          }
                        }
                      },
                      config: {
                        text: 'Login',
                        styles: { styleTemplate: 'hosp.header.authButton' },
                        click: { actionId: 'open-login-popup' }
                      }
                    },
                    {
                      id: 'hospital-home-header-user-display',
                      type: 'button',
                      condition: {
                        expression: "userId && String(userId).trim().length > 0",
                        mappings: {
                          userId: {
                            packageName: 'hospital',
                            key: 'AuthSession',
                            property: 'userId'
                          }
                        }
                      },
                      config: {
                        mapping: { packageName: 'hospital', key: 'AuthSession', property: 'userDisplayName' },
                        styles: { styleTemplate: 'hosp.header.userButton' }
                      }
                    },
                    {
                      id: 'hospital-home-header-login-state',
                      type: 'text',
                      condition: {
                        expression: "userId && String(userId).trim().length > 0",
                        mappings: {
                          userId: {
                            packageName: 'hospital',
                            key: 'AuthSession',
                            property: 'userId'
                          }
                        }
                      },
                      config: {
                        text: 'Logged in',
                        styles: { styleTemplate: 'hosp.header.loginStateChip' }
                      }
                    },
                    {
                      id: 'hospital-home-header-logout',
                      type: 'button',
                      condition: {
                        expression: "userId && String(userId).trim().length > 0",
                        mappings: {
                          userId: {
                            packageName: 'hospital',
                            key: 'AuthSession',
                            property: 'userId'
                          }
                        }
                      },
                      config: {
                        text: 'Logout',
                        styles: { styleTemplate: 'hosp.header.authButton' },
                        click: { actionId: 'logout-user' }
                      }
                    },
                    {
                      id: 'hospital-home-header-cta',
                      type: 'button',
                      config: {
                        text: 'Book Now',
                        styles: { styleTemplate: 'hosp.header.ctaButton' },
                        click: { actionId: 'open-appointment-popup' }
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        {
          id: 'hospital-home-hero-section',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.hero.section',
            styles: { styleTemplate: 'hosp.section.card' },
            children: [
              {
                id: 'hospital-home-hero-copy',
                type: 'container',
                config: {
                  layoutTemplate: 'hosp.hero.copy',
                  children: [
                    {
                      id: 'hospital-home-hero-title',
                      type: 'text',
                      config: {
                        mapping: { packageName: 'hospital', key: 'HomeContent', path: 'hero', property: 'title' },
                        styles: { styleTemplate: 'hosp.hero.title' }
                      }
                    },
                    {
                      id: 'hospital-home-hero-subtitle',
                      type: 'text',
                      config: {
                        mapping: {
                          packageName: 'hospital',
                          key: 'HomeContent',
                          path: 'hero',
                          property: 'subtitle'
                        },
                        styles: { styleTemplate: 'hosp.hero.subtitle' }
                      }
                    },
                    {
                      id: 'hospital-home-hero-actions',
                      type: 'container',
                      config: {
                        layoutTemplate: 'hosp.form.actions',
                        children: [
                          {
                            id: 'hospital-home-hero-primary-cta',
                            type: 'button',
                            config: {
                              text: 'Schedule Visit',
                              styles: { styleTemplate: 'hosp.button.primary' },
                              click: { actionId: 'open-appointment-popup' }
                            }
                          },
                          {
                            id: 'hospital-home-hero-secondary-cta',
                            type: 'button',
                            config: {
                              text: 'Emergency Care',
                              styles: { styleTemplate: 'hosp.button.secondary' }
                            }
                          }
                        ]
                      }
                    },
                    {
                      id: 'hospital-home-hero-stats-list',
                      type: 'list',
                      config: {
                        listStyleTemplate: 'hosp.stats.row',
                        mapping: { packageName: 'hospital', key: 'HomeContent', property: 'stats' },
                        itemTemplate: {
                          layoutTemplate: 'hosp.stat.card',
                          children: [
                            {
                              id: 'hospital-home-hero-stat-value',
                              type: 'text',
                              config: { text: '{{value}}', styles: { styleTemplate: 'hosp.stats.value' } }
                            },
                            {
                              id: 'hospital-home-hero-stat-label',
                              type: 'text',
                              config: { text: '{{label}}', styles: { styleTemplate: 'hosp.stats.label' } }
                            }
                          ]
                        }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-home-hero-image',
                type: 'image',
                config: {
                  mapping: { packageName: 'hospital', key: 'HomeContent', path: 'hero', property: 'image' },
                  styles: { styleTemplate: 'hosp.hero.image' },
                  alt: 'Hospital hero'
                }
              }
            ]
          }
        },
        {
          id: 'hospital-home-services-section',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.section.stack',
            children: [
              {
                id: 'hospital-home-services-heading',
                type: 'text',
                config: { text: 'Our Medical Services', styles: { styleTemplate: 'hosp.section.heading' } }
              },
              {
                id: 'hospital-home-services-subheading',
                type: 'text',
                config: {
                  text: 'Comprehensive healthcare services delivered with excellence and compassion',
                  styles: { styleTemplate: 'hosp.section.subheading' }
                }
              },
              {
                id: 'hospital-home-services-list',
                type: 'list',
                config: {
                  listStyleTemplate: 'hosp.services.grid',
                  mapping: { packageName: 'hospital', key: 'HomeContent', property: 'services' },
                  itemTemplate: {
                    layoutTemplate: 'hosp.service.card',
                    styles: { styleTemplate: 'hosp.service.card' },
                    children: [
                        {
                          id: 'hospital-home-service-image',
                          type: 'image',
                          config: { src: '{{image}}', styles: { styleTemplate: 'hosp.service.image' } }
                        },
                      {
                        id: 'hospital-home-service-icon',
                        type: 'text',
                        config: { text: '{{icon}}', styles: { styleTemplate: 'hosp.service.icon' } }
                      },
                      {
                        id: 'hospital-home-service-name',
                        type: 'text',
                        config: { text: '{{name}}', styles: { styleTemplate: 'hosp.service.title' } }
                      },
                      {
                        id: 'hospital-home-service-description',
                        type: 'text',
                        config: {
                          text: '{{description}}',
                          styles: { styleTemplate: 'hosp.service.description' }
                        }
                      }
                    ]
                  }
                }
              }
            ]
          }
        },
        {
          id: 'hospital-home-doctors-section',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.section.stack',
            children: [
              {
                id: 'hospital-home-doctors-heading',
                type: 'text',
                config: { text: 'Meet Our Expert Doctors', styles: { styleTemplate: 'hosp.section.heading' } }
              },
              {
                id: 'hospital-home-doctors-subheading',
                type: 'text',
                config: {
                  text: 'Our team of highly qualified and experienced medical professionals',
                  styles: { styleTemplate: 'hosp.section.subheading' }
                }
              },
              {
                id: 'hospital-home-doctors-list',
                type: 'list',
                config: {
                  listStyleTemplate: 'hosp.doctors.grid',
                  mapping: { packageName: 'hospital', key: 'HomeContent', property: 'doctors' },
                  itemTemplate: {
                    layoutTemplate: 'hosp.doctor.card',
                    styles: { styleTemplate: 'hosp.doctor.card' },
                    children: [
                      {
                        id: 'hospital-home-doctor-image',
                        type: 'image',
                        config: { src: '{{image}}', styles: { styleTemplate: 'hosp.doctor.image' } }
                      },
                      {
                        id: 'hospital-home-doctor-name',
                        type: 'text',
                        config: { text: '{{name}}', styles: { styleTemplate: 'hosp.doctor.name' } }
                      },
                      {
                        id: 'hospital-home-doctor-speciality',
                        type: 'text',
                        config: { text: '{{speciality}}', styles: { styleTemplate: 'hosp.doctor.meta' } }
                      },
                      {
                        id: 'hospital-home-doctor-degree',
                        type: 'text',
                        config: { text: '{{degree}}', styles: { styleTemplate: 'hosp.doctor.meta' } }
                      },
                      {
                        id: 'hospital-home-doctor-experience',
                        type: 'text',
                        config: { text: '{{experience}}', styles: { styleTemplate: 'hosp.doctor.meta' } }
                      }
                    ]
                  }
                }
              }
            ]
          }
        },
        {
          id: 'hospital-home-highlights-section',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.section.stack',
            styles: { styleTemplate: 'hosp.section.card' },
            children: [
              {
                id: 'hospital-home-highlights-heading',
                type: 'text',
                config: { text: 'Why Choose Little Sprouts Care?', styles: { styleTemplate: 'hosp.section.heading' } }
              },
              {
                id: 'hospital-home-highlights-list',
                type: 'list',
                config: {
                  listStyleTemplate: 'hosp.highlights.grid',
                  mapping: { packageName: 'hospital', key: 'HomeContent', property: 'highlights' },
                  itemTemplate: {
                    layoutTemplate: 'hosp.highlight.card',
                    styles: { styleTemplate: 'hosp.highlight.card' },
                    children: [
                      {
                        id: 'hospital-home-highlight-title',
                        type: 'text',
                        config: { text: '{{title}}', styles: { styleTemplate: 'hosp.highlight.title' } }
                      },
                      {
                        id: 'hospital-home-highlight-detail',
                        type: 'text',
                        config: { text: '{{detail}}', styles: { styleTemplate: 'hosp.highlight.detail' } }
                      }
                    ]
                  }
                }
              }
            ]
          }
        },
        {
          id: 'hospital-home-booking-form-section',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.section.stack',
            styles: { styleTemplate: 'hosp.section.card' },
            children: [
              {
                id: 'hospital-book-appointment-page-heading',
                type: 'text',
                config: { text: 'Schedule a Consultation', styles: { styleTemplate: 'hosp.section.heading' } }
              },
              {
                id: 'hospital-home-booking-form-grid',
                type: 'container',
                config: {
                  layoutTemplate: 'hosp.form.grid',
                  children: [
                    {
                      id: 'hospital-book-appointment-doctor-select',
                      type: 'dropdown',
                      config: {
                        label: 'Select Doctor',
                        mapping: { packageName: 'hospital', key: 'Doctors', property: 'list' },
                        styles: { styleTemplate: 'hosp.form.input' }
                      }
                    },
                    {
                      id: 'hospital-book-appointment-preferred-date',
                      type: 'input',
                      config: {
                        label: 'Preferred Date',
                        inputType: 'date',
                        styles: { styleTemplate: 'hosp.form.input' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-book-appointment-submit',
                type: 'button',
                config: {
                  text: 'Book Appointment',
                  styles: { styleTemplate: 'hosp.button.primary' },
                  click: { actionId: 'open-appointment-popup' }
                }
              }
            ]
          }
        },
        {
          id: 'hospital-home-contact-section',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.section.stack',
            styles: { styleTemplate: 'hosp.section.card' },
            children: [
              {
                id: 'hospital-home-contact-heading',
                type: 'text',
                config: { text: 'Get In Touch', styles: { styleTemplate: 'hosp.section.heading' } }
              },
              {
                id: 'hospital-home-contact-phone',
                type: 'text',
                config: {
                  mapping: { packageName: 'hospital', key: 'HomeContent', path: 'contact', property: 'phone' },
                  styles: { styleTemplate: 'hosp.contact.block' }
                }
              },
              {
                id: 'hospital-home-contact-location',
                type: 'text',
                config: {
                  mapping: { packageName: 'hospital', key: 'HomeContent', path: 'contact', property: 'location' },
                  styles: { styleTemplate: 'hosp.contact.block' }
                }
              },
              {
                id: 'hospital-home-contact-hours',
                type: 'text',
                config: {
                  mapping: { packageName: 'hospital', key: 'HomeContent', path: 'contact', property: 'hours' },
                  styles: { styleTemplate: 'hosp.contact.block' }
                }
              }
            ]
          }
        }
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'patient-dashboard',
    title: 'Patient Dashboard',
    initializeActions: [{ actionId: 'load-home-content' }],
    container: {
      layoutTemplate: 'hosp.page.root',
      children: [
        {
          id: 'hospital-patient-dashboard-intro',
          type: 'text',
          config: { text: 'Patient Dashboard', styles: { styleTemplate: 'hosp.section.heading' } }
        },
        {
          id: 'hospital-patient-dashboard-next-steps',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.section.stack',
            styles: { styleTemplate: 'hosp.section.card' },
            children: [
              {
                id: 'hospital-patient-dashboard-guidance',
                type: 'text',
                config: {
                  text: 'Review upcoming care highlights and schedule follow-up appointments quickly.',
                  styles: { styleTemplate: 'hosp.section.subheading' }
                }
              },
              {
                id: 'hospital-patient-dashboard-highlights',
                type: 'list',
                config: {
                  listStyleTemplate: 'hosp.highlights.grid',
                  mapping: { packageName: 'hospital', key: 'HomeContent', property: 'highlights' },
                  itemTemplate: {
                    layoutTemplate: 'hosp.highlight.card',
                    styles: { styleTemplate: 'hosp.highlight.card' },
                    children: [
                      {
                        id: 'hospital-patient-dashboard-highlight-title',
                        type: 'text',
                        config: { text: '{{title}}', styles: { styleTemplate: 'hosp.highlight.title' } }
                      },
                      {
                        id: 'hospital-patient-dashboard-highlight-detail',
                        type: 'text',
                        config: { text: '{{detail}}', styles: { styleTemplate: 'hosp.highlight.detail' } }
                      }
                    ]
                  }
                }
              }
            ]
          }
        }
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'doctor-overview',
    title: 'Doctor Overview',
    initializeActions: [{ actionId: 'load-home-content' }],
    container: {
      layoutTemplate: 'hosp.page.root',
      children: [
        {
          id: 'hospital-doctor-overview-intro',
          type: 'text',
          config: { text: 'Doctor Overview', styles: { styleTemplate: 'hosp.section.heading' } }
        },
        {
          id: 'hospital-doctor-overview-list',
          type: 'list',
          config: {
            listStyleTemplate: 'hosp.doctors.grid',
            mapping: { packageName: 'hospital', key: 'HomeContent', property: 'doctors' },
            itemTemplate: {
              layoutTemplate: 'hosp.doctor.card',
              styles: { styleTemplate: 'hosp.doctor.card' },
              children: [
                {
                  id: 'hospital-doctor-overview-image',
                  type: 'image',
                  config: { src: '{{image}}', styles: { styleTemplate: 'hosp.doctor.image' } }
                },
                {
                  id: 'hospital-doctor-overview-name',
                  type: 'text',
                  config: { text: '{{name}}', styles: { styleTemplate: 'hosp.doctor.name' } }
                },
                {
                  id: 'hospital-doctor-overview-speciality',
                  type: 'text',
                  config: { text: '{{speciality}}', styles: { styleTemplate: 'hosp.doctor.meta' } }
                },
                {
                  id: 'hospital-doctor-overview-degree',
                  type: 'text',
                  config: { text: '{{degree}}', styles: { styleTemplate: 'hosp.doctor.meta' } }
                },
                {
                  id: 'hospital-doctor-overview-experience',
                  type: 'text',
                  config: { text: '{{experience}}', styles: { styleTemplate: 'hosp.doctor.meta' } }
                }
              ]
            }
          }
        }
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'login-popup',
    title: 'Login',
    container: {
      layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-4'] },
      children: [
        {
          id: 'hospital-login-popup-header',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.popup.header',
            children: [
              {
                id: 'hospital-login-popup-title',
                type: 'text',
                config: { text: 'Login', styles: { styleTemplate: 'hosp.popup.header.title' } }
              },
              {
                id: 'hospital-login-popup-close',
                type: 'button',
                config: {
                  text: 'X',
                  styles: { styleTemplate: 'hosp.popup.header.closeButton' },
                  click: { actionType: 'closePopup' }
                }
              }
            ]
          }
        },
        {
          id: 'hospital-login-popup-info-message',
          type: 'text',
          condition: {
            expression: 'loginInfoMessage && loginInfoMessage.length > 0',
            mappings: {
              loginInfoMessage: {
                packageName: 'hospital',
                key: 'AuthForm',
                property: 'loginInfoMessage'
              }
            }
          },
          config: {
            mapping: { packageName: 'hospital', key: 'AuthForm', property: 'loginInfoMessage' },
            styles: { styleTemplate: 'hosp.form.infoText' }
          }
        },
        {
          id: 'hospital-login-popup-form',
          type: 'container',
          config: {
            layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-4'] },
            styles: { utilityClasses: 'w-full max-w-md mx-auto' },
            children: [
              {
                id: 'hospital-login-popup-identity-row',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-3'] },
                  children: [
                    {
                      id: 'hospital-login-popup-identity-label',
                      type: 'text',
                      config: { text: 'Email', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
                    },
                    {
                      id: 'hospital-login-popup-identity',
                      type: 'input',
                      config: {
                        placeholder: 'youremail@example.com',
                        styles: { styleTemplate: 'hosp.form.input' },
                        labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                        change: { actionId: 'set-auth-identity' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-login-popup-identity-error',
                type: 'text',
                condition: {
                  expression: 'emailError && emailError.length > 0',
                  mappings: {
                    emailError: {
                      packageName: 'hospital',
                      key: 'AuthForm',
                      property: 'emailError'
                    }
                  }
                },
                config: {
                  mapping: { packageName: 'hospital', key: 'AuthForm', property: 'emailError' },
                  styles: { styleTemplate: 'hosp.form.errorText' }
                }
              },
              {
                id: 'hospital-login-popup-password-row',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-3'] },
                  children: [
                    {
                      id: 'hospital-login-popup-password-label',
                      type: 'text',
                      config: { text: 'Password', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
                    },
                    {
                      id: 'hospital-login-popup-password',
                      type: 'input',
                      config: {
                        inputType: 'password',
                        placeholder: 'Enter password',
                        styles: { styleTemplate: 'hosp.form.input' },
                        labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                        change: { actionId: 'set-auth-password' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-login-popup-auth-error',
                type: 'text',
                condition: {
                  expression: 'authError && authError.length > 0',
                  mappings: {
                    authError: {
                      packageName: 'hospital',
                      key: 'AuthForm',
                      property: 'authError'
                    }
                  }
                },
                config: {
                  mapping: { packageName: 'hospital', key: 'AuthForm', property: 'authError' },
                  styles: { styleTemplate: 'hosp.form.errorText' }
                }
              },
              {
                id: 'hospital-login-popup-actions',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'justify-center', 'items-center', 'gap-3', 'flex-wrap'] },
                  children: [
                    {
                      id: 'hospital-login-popup-cancel',
                      type: 'button',
                      config: {
                        text: 'Cancel',
                        styles: { styleTemplate: 'hosp.popup.button.secondary' },
                        click: { actionType: 'closePopup' }
                      }
                    },
                    {
                      id: 'hospital-login-popup-login-disabled',
                      type: 'button',
                      condition: {
                        expression:
                          "!identity || String(identity).trim().length === 0 || !password || String(password).trim().length === 0 || (emailError && String(emailError).trim().length > 0)",
                        mappings: {
                          identity: {
                            packageName: 'hospital',
                            key: 'AuthForm',
                            property: 'identity'
                          },
                          password: {
                            packageName: 'hospital',
                            key: 'AuthForm',
                            property: 'password'
                          },
                          emailError: {
                            packageName: 'hospital',
                            key: 'AuthForm',
                            property: 'emailError'
                          }
                        }
                      },
                      config: {
                        text: 'Login',
                        disabled: true,
                        styles: { styleTemplate: 'hosp.popup.button.disabled' }
                      }
                    },
                    {
                      id: 'hospital-login-popup-login',
                      type: 'button',
                      condition: {
                        expression:
                          "identity && String(identity).trim().length > 0 && password && String(password).trim().length > 0 && (!emailError || String(emailError).trim().length === 0)",
                        mappings: {
                          identity: {
                            packageName: 'hospital',
                            key: 'AuthForm',
                            property: 'identity'
                          },
                          password: {
                            packageName: 'hospital',
                            key: 'AuthForm',
                            property: 'password'
                          },
                          emailError: {
                            packageName: 'hospital',
                            key: 'AuthForm',
                            property: 'emailError'
                          }
                        }
                      },
                      config: {
                        text: 'Login',
                        styles: { styleTemplate: 'hosp.popup.button.primary' },
                        click: {
                          actionId: 'auth-login',
                          mappings: {
                            identity: {
                              packageName: 'hospital',
                              key: 'AuthForm',
                              property: 'identity',
                              hideNil: true
                            },
                            password: {
                              packageName: 'hospital',
                              key: 'AuthForm',
                              property: 'password',
                              hideNil: true
                            }
                          },
                          onSuccess: { actionType: 'closePopup' }
                        }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-login-popup-register-link-row',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'justify-center', 'items-center'] },
                  children: [
                    {
                      id: 'hospital-login-popup-register-link',
                      type: 'button',
                      config: {
                        text: 'New user? Register',
                        styles: { styleTemplate: 'hosp.popup.linkButton' },
                        click: {
                          actionId: 'open-register-popup'
                        }
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
  {
    packageName: 'hospital',
    pageId: 'register-popup',
    title: 'Register',
    container: {
      layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-4'] },
      children: [
        {
          id: 'hospital-register-popup-header',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.popup.header',
            children: [
              {
                id: 'hospital-register-popup-title',
                type: 'text',
                config: { text: 'Register', styles: { styleTemplate: 'hosp.popup.header.title' } }
              },
              {
                id: 'hospital-register-popup-close',
                type: 'button',
                config: {
                  text: 'X',
                  styles: { styleTemplate: 'hosp.popup.header.closeButton' },
                  click: { actionType: 'closePopup' }
                }
              }
            ]
          }
        },
        {
          id: 'hospital-register-popup-form',
          type: 'container',
          config: {
            layout: {
              type: 'grid',
              grid: ['grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-4', 'md:gap-5']
            },
            styles: { utilityClasses: 'w-full max-w-4xl mx-auto' },
            children: [
              {
                id: 'hospital-register-popup-first-name-row',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-3'] },
                  children: [
                    {
                      id: 'hospital-register-popup-first-name-label',
                      type: 'text',
                      config: { text: 'FirstName', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
                    },
                    {
                      id: 'hospital-register-popup-first-name',
                      type: 'input',
                      config: {
                        placeholder: 'Enter first name',
                        styles: { styleTemplate: 'hosp.form.input' },
                        labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                        change: { actionId: 'set-register-first-name' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-register-popup-last-name-row',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-3'] },
                  children: [
                    {
                      id: 'hospital-register-popup-last-name-label',
                      type: 'text',
                      config: { text: 'LastName', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
                    },
                    {
                      id: 'hospital-register-popup-last-name',
                      type: 'input',
                      config: {
                        placeholder: 'Enter last name',
                        styles: { styleTemplate: 'hosp.form.input' },
                        labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                        change: { actionId: 'set-register-last-name' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-register-popup-email-row',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-3'] },
                  children: [
                    {
                      id: 'hospital-register-popup-email-label',
                      type: 'text',
                      config: { text: 'EmailId', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
                    },
                    {
                      id: 'hospital-register-popup-email',
                      type: 'input',
                      config: {
                        placeholder: 'youremail@example.com',
                        styles: { styleTemplate: 'hosp.form.input' },
                        labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                        change: { actionId: 'set-register-email' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-register-popup-password-row',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-3'] },
                  children: [
                    {
                      id: 'hospital-register-popup-password-label',
                      type: 'text',
                      config: { text: 'Password', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
                    },
                    {
                      id: 'hospital-register-popup-password',
                      type: 'input',
                      config: {
                        inputType: 'password',
                        placeholder: 'Enter password',
                        styles: { styleTemplate: 'hosp.form.input' },
                        labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                        change: { actionId: 'set-register-password' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-register-popup-address-row',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-3'] },
                  children: [
                    {
                      id: 'hospital-register-popup-address-label',
                      type: 'text',
                      config: { text: 'Address', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
                    },
                    {
                      id: 'hospital-register-popup-address',
                      type: 'input',
                      config: {
                        placeholder: 'Enter address',
                        styles: { styleTemplate: 'hosp.form.input' },
                        labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                        change: { actionId: 'set-register-address' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-register-popup-gender-row',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-3'] },
                  children: [
                    {
                      id: 'hospital-register-popup-gender-label',
                      type: 'text',
                      config: { text: 'Gender', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
                    },
                    {
                      id: 'hospital-register-popup-gender-field',
                      type: 'container',
                      config: {
                        layout: { type: 'flex', flex: ['flex', 'items-center', 'w-full'] },
                        styles: { utilityClasses: 'flex-1' },
                        children: [
                          {
                            id: 'hospital-register-popup-gender',
                            type: 'radio-group',
                            config: {
                              options: [
                                { label: 'Male', value: 'male' },
                                { label: 'Female', value: 'female' }
                              ],
                              change: { actionId: 'set-register-gender' }
                            }
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-register-popup-mobile-row',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-3'] },
                  children: [
                    {
                      id: 'hospital-register-popup-mobile-label',
                      type: 'text',
                      config: { text: 'Phone', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
                    },
                    {
                      id: 'hospital-register-popup-mobile',
                      type: 'input',
                      config: {
                        placeholder: 'Enter mobile number',
                        styles: { styleTemplate: 'hosp.form.input' },
                        labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                        change: { actionId: 'set-register-mobile' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-register-popup-role-row',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-3'] },
                  children: [
                    {
                      id: 'hospital-register-popup-role-label',
                      type: 'text',
                      config: { text: 'Role', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
                    },
                    {
                      id: 'hospital-register-popup-role-field',
                      type: 'container',
                      config: {
                        layout: { type: 'flex', flex: ['flex', 'items-center', 'w-full'] },
                        styles: { utilityClasses: 'flex-1' },
                        children: [
                          {
                            id: 'hospital-register-popup-role',
                            type: 'dropdown',
                            config: {
                              options: [
                                { id: 'role-patient', label: 'Patient', value: 'PATIENT' },
                                { id: 'role-doctor', label: 'Doctor (Admin Approval Required)', value: 'DOCTOR' },
                                { id: 'role-admin', label: 'Admin (Admin Approval Required)', value: 'ADMIN' }
                              ],
                              labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                              change: { actionId: 'set-register-role' },
                              styles: { styleTemplate: 'hosp.form.input' }
                            }
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-register-popup-department-row',
                type: 'container',
                condition: {
                  expression: "role && String(role).toUpperCase() === 'DOCTOR'",
                  mappings: {
                    role: {
                      packageName: 'hospital',
                      key: 'RegisterForm',
                      property: 'role'
                    }
                  }
                },
                config: {
                  layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-3'] },
                  styles: { utilityClasses: 'md:col-start-2' },
                  children: [
                    {
                      id: 'hospital-register-popup-department-label',
                      type: 'text',
                      config: { text: 'Department', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
                    },
                    {
                      id: 'hospital-register-popup-department-field',
                      type: 'container',
                      config: {
                        layout: { type: 'flex', flex: ['flex', 'items-center', 'w-full'] },
                        styles: { utilityClasses: 'flex-1' },
                        children: [
                          {
                            id: 'hospital-register-popup-department',
                            type: 'dropdown',
                            config: {
                              mapping: { packageName: 'hospital', key: 'MedicalDepartments', property: 'list' },
                              labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                              change: { actionId: 'set-register-department' },
                              styles: { styleTemplate: 'hosp.form.input' }
                            }
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-register-popup-error',
                type: 'text',
                condition: {
                  expression: 'registerError && registerError.length > 0',
                  mappings: {
                    registerError: {
                      packageName: 'hospital',
                      key: 'RegisterForm',
                      property: 'registerError'
                    }
                  }
                },
                config: {
                  mapping: { packageName: 'hospital', key: 'RegisterForm', property: 'registerError' },
                  styles: { styleTemplate: 'hosp.form.errorText', utilityClasses: 'md:col-span-2' }
                }
              }
            ]
          }
        },
        {
          id: 'hospital-register-popup-actions',
          type: 'container',
          config: {
            layout: { type: 'flex', flex: ['flex', 'justify-center', 'items-center', 'gap-3'] },
            children: [
              {
                id: 'hospital-register-popup-cancel',
                type: 'button',
                config: {
                  text: 'Cancel',
                  styles: { styleTemplate: 'hosp.popup.button.secondary' },
                  click: { actionType: 'closePopup' }
                }
              },
              {
                id: 'hospital-register-popup-submit',
                type: 'button',
                config: {
                  text: 'Register',
                  styles: { styleTemplate: 'hosp.popup.button.primary' },
                  click: {
                    actionId: 'register-user',
                    mappings: {
                      firstName: {
                        packageName: 'hospital',
                        key: 'RegisterForm',
                        property: 'firstName',
                        hideNil: true
                      },
                      lastName: {
                        packageName: 'hospital',
                        key: 'RegisterForm',
                        property: 'lastName',
                        hideNil: true
                      },
                      emailId: {
                        packageName: 'hospital',
                        key: 'RegisterForm',
                        property: 'emailId',
                        hideNil: true
                      },
                      password: {
                        packageName: 'hospital',
                        key: 'RegisterForm',
                        property: 'password',
                        hideNil: true
                      },
                      address: {
                        packageName: 'hospital',
                        key: 'RegisterForm',
                        property: 'address',
                        hideNil: true
                      },
                      gender: {
                        packageName: 'hospital',
                        key: 'RegisterForm',
                        property: 'gender',
                        hideNil: true
                      },
                      mobileNumber: {
                        packageName: 'hospital',
                        key: 'RegisterForm',
                        property: 'mobileNumber',
                        hideNil: true
                      },
                      role: {
                        packageName: 'hospital',
                        key: 'RegisterForm',
                        property: 'role',
                        hideNil: true
                      },
                      department: {
                        packageName: 'hospital',
                        key: 'RegisterForm',
                        property: 'department',
                        hideNil: true
                      }
                    },
                    onSuccess: {
                      actionId: 'open-login-popup-after-register',
                      mappings: {
                        identity: {
                          packageName: 'hospital',
                          key: 'RegisterForm',
                          property: 'emailId',
                          hideNil: true
                        }
                      }
                    }
                  }
                }
              }
            ]
          }
        }
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'register-success-popup',
    title: 'Registration Success',
    container: {
      layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-6'] },
      children: [
        {
          id: 'hospital-register-success-header',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.popup.header',
            children: [
              {
                id: 'hospital-register-success-title',
                type: 'text',
                config: { text: 'Registration Successful', styles: { styleTemplate: 'hosp.popup.header.title' } }
              }
            ]
          }
        },
        {
          id: 'hospital-register-success-message',
          type: 'text',
          config: {
            mapping: { packageName: 'hospital', key: 'RegisterForm', property: 'registerSuccessMessage' },
            styles: { styleTemplate: 'hosp.section.subheading', utilityClasses: 'block text-center' }
          }
        },
        {
          id: 'hospital-register-success-actions',
          type: 'container',
          config: {
            layout: { type: 'flex', flex: ['flex', 'justify-center', 'items-center'] },
            children: [
              {
                id: 'hospital-register-success-ok',
                type: 'button',
                config: {
                  text: 'Ok',
                  styles: { styleTemplate: 'hosp.popup.button.primary' },
                  click: { actionId: 'ack-register-success' }
                }
              }
            ]
          }
        }
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'appointment-popup',
    title: 'Book an Appointment',
    container: {
      layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-4'] },
      children: [
        {
          id: 'hospital-popup-header',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.popup.header',
            children: [
              {
                id: 'hospital-popup-title',
                type: 'text',
                config: { text: 'Book an Appointment', styles: { styleTemplate: 'hosp.popup.header.title' } }
              },
              {
                id: 'hospital-popup-close',
                type: 'button',
                config: {
                  text: 'X',
                  styles: { styleTemplate: 'hosp.popup.header.closeButton' },
                  click: { actionType: 'closePopup' }
                }
              }
            ]
          }
        },
        {
          id: 'hospital-popup-divider',
          type: 'container',
          config: {
            styles: { utilityClasses: 'h-px w-full bg-slate-200' },
            children: []
          }
        },
        {
          id: 'hospital-popup-form-grid',
          type: 'container',
          config: {
            layout: { type: 'grid', grid: ['grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-4'] },
            children: [
              {
                id: 'hospital-popup-full-name',
                type: 'input',
                config: {
                  label: 'Patient Name *',
                  placeholder: 'Your Name',
                  mapping: { packageName: 'hospital', key: 'AuthSession', property: 'fullName' },
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-email',
                type: 'input',
                config: {
                  label: 'Email Address *',
                  placeholder: 'youremail@example.com',
                  mapping: { packageName: 'hospital', key: 'AuthSession', property: 'email' },
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-phone',
                type: 'input',
                config: {
                  label: 'Phone Number *',
                  placeholder: 'Phone Number',
                  mapping: { packageName: 'hospital', key: 'AuthSession', property: 'mobileNumber' },
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-age',
                type: 'dropdown',
                config: {
                  label: 'Age *',
                  options: [
                    { id: 'AgeBelow1', label: 'Below 1 Year', value: 'LessThan1Year' },
                    { id: 'OneToTen', label: '1 - 10 Years', value: 'OneToTen' },
                    { id: 'dAbove10', label: 'Above 10 Years', value: 'Above10' }
                  ],
                  change: { actionId: 'set-appointment-age' },
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-appointment-department',
                type: 'dropdown',
                config: {
                  label: 'Department *',
                  mapping: { packageName: 'hospital', key: 'AppointmentDepartments', property: 'list' },
                  change: { actionId: 'set-appointment-department' },
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-appointment-doctor-disabled',
                type: 'dropdown',
                condition: {
                  expression: "!department || String(department).trim().length === 0",
                  mappings: {
                    department: {
                      packageName: 'hospital',
                      key: 'AppointmentForm',
                      property: 'department'
                    }
                  }
                },
                config: {
                  label: 'Doctor (Select Department First)*',
                  disabled: true,
                  options: [],
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-appointment-doctor',
                type: 'dropdown',
                condition: {
                  expression: "department && String(department).trim().length > 0",
                  mappings: {
                    department: {
                      packageName: 'hospital',
                      key: 'AppointmentForm',
                      property: 'department'
                    }
                  }
                },
                config: {
                  label: 'Doctor *',
                  mapping: { packageName: 'hospital', key: 'AppointmentDoctors', property: 'list' },
                  change: { actionId: 'set-appointment-doctor' },
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-appointment-doctor-load-error',
                type: 'text',
                condition: {
                  expression: 'doctorLoadError && doctorLoadError.length > 0',
                  mappings: {
                    doctorLoadError: {
                      packageName: 'hospital',
                      key: 'AppointmentForm',
                      property: 'doctorLoadError'
                    }
                  }
                },
                config: {
                  mapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'doctorLoadError' },
                  styles: {
                    styleTemplate: 'hosp.form.errorText',
                    utilityClasses: 'ml-0 md:col-start-2'
                  }
                }
              },
              {
                id: 'hospital-popup-date',
                type: 'input',
                config: {
                  label: 'Preferred Date *',
                  inputType: 'date',
                  min: todayDateInputValue,
                  change: { actionId: 'set-appointment-date' },
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-time-slot-disabled',
                type: 'dropdown',
                condition: {
                  expression: "!preferredDate || String(preferredDate).trim().length === 0",
                  mappings: {
                    preferredDate: {
                      packageName: 'hospital',
                      key: 'AppointmentForm',
                      property: 'preferredDate'
                    }
                  }
                },
                config: {
                  label: 'Preferred Time Slot *',
                  disabled: true,
                  options: [
                    { id: 't1000', label: '10:00 AM - 10:15 AM', value: '10:00-10:15' },
                    { id: 't1015', label: '10:15 AM - 10:30 AM', value: '10:15-10:30' },
                    { id: 't1030', label: '10:30 AM - 10:45 AM', value: '10:30-10:45' },
                    { id: 't1045', label: '10:45 AM - 11:00 AM', value: '10:45-11:00' },
                    { id: 't1100', label: '11:00 AM - 11:15 AM', value: '11:00-11:15' },
                    { id: 't1115', label: '11:15 AM - 11:30 AM', value: '11:15-11:30' },
                    { id: 't1130', label: '11:30 AM - 11:45 AM', value: '11:30-11:45' },
                    { id: 't1145', label: '11:45 AM - 12:00 PM', value: '11:45-12:00' },
                    { id: 't1200', label: '12:00 PM - 12:15 PM', value: '12:00-12:15' },
                    { id: 't1215', label: '12:15 PM - 12:30 PM', value: '12:15-12:30' },
                    { id: 't1230', label: '12:30 PM - 12:45 PM', value: '12:30-12:45' },
                    { id: 't1245', label: '12:45 PM - 01:00 PM', value: '12:45-13:00' }
                  ],
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-time-slot',
                type: 'dropdown',
                condition: {
                  expression: "preferredDate && String(preferredDate).trim().length > 0",
                  mappings: {
                    preferredDate: {
                      packageName: 'hospital',
                      key: 'AppointmentForm',
                      property: 'preferredDate'
                    }
                  }
                },
                config: {
                  label: 'Preferred Time Slot *',
                  options: [
                    { id: 't1000', label: '10:00 AM - 10:15 AM', value: '10:00-10:15' },
                    { id: 't1015', label: '10:15 AM - 10:30 AM', value: '10:15-10:30' },
                    { id: 't1030', label: '10:30 AM - 10:45 AM', value: '10:30-10:45' },
                    { id: 't1045', label: '10:45 AM - 11:00 AM', value: '10:45-11:00' },
                    { id: 't1100', label: '11:00 AM - 11:15 AM', value: '11:00-11:15' },
                    { id: 't1115', label: '11:15 AM - 11:30 AM', value: '11:15-11:30' },
                    { id: 't1130', label: '11:30 AM - 11:45 AM', value: '11:30-11:45' },
                    { id: 't1145', label: '11:45 AM - 12:00 PM', value: '11:45-12:00' },
                    { id: 't1200', label: '12:00 PM - 12:15 PM', value: '12:00-12:15' },
                    { id: 't1215', label: '12:15 PM - 12:30 PM', value: '12:15-12:30' },
                    { id: 't1230', label: '12:30 PM - 12:45 PM', value: '12:30-12:45' },
                    { id: 't1245', label: '12:45 PM - 01:00 PM', value: '12:45-13:00' }
                  ],
                  change: { actionId: 'set-appointment-time-slot' },
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-notes',
                type: 'input',
                config: {
                  label: 'Additional Notes',
                  inputType: 'textarea',
                  rows: 5,
                  placeholder: 'Tell us about your symptoms or concerns...',
                  change: { actionId: 'set-appointment-notes' },
                  styles: { styleTemplate: 'hosp.form.textarea' }
                }
              },
              {
                id: 'hospital-popup-prescription-upload',
                type: 'input',
                config: {
                  label: 'Prescription (Upload Latest two Images)',
                  inputType: 'file',
                  accept: 'image/*',
                  multiple: true,
                  change: { actionId: 'set-appointment-prescriptions' },
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-prescription-upload-error',
                type: 'text',
                condition: {
                  expression: 'prescriptionUploadError && prescriptionUploadError.length > 0',
                  mappings: {
                    prescriptionUploadError: {
                      packageName: 'hospital',
                      key: 'AppointmentForm',
                      property: 'prescriptionUploadError'
                    }
                  }
                },
                config: {
                  mapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'prescriptionUploadError' },
                  styles: {
                    styleTemplate: 'hosp.form.errorText',
                    utilityClasses: 'ml-0 md:col-start-2'
                  }
                }
              }
            ]
          }
        },
        {
          id: 'hospital-popup-actions',
          type: 'container',
          config: {
            layout: { type: 'flex', flex: ['flex', 'items-center', 'justify-center', 'gap-3', 'flex-wrap'] },
            children: [
              {
                id: 'hospital-popup-cancel',
                type: 'button',
                config: {
                  text: 'Cancel',
                  styles: { styleTemplate: 'hosp.popup.button.secondary' },
                  click: { actionType: 'closePopup' }
                }
              },
              {
                id: 'hospital-popup-submit',
                type: 'button',
                config: {
                  text: 'Submit Request',
                  styles: { styleTemplate: 'hosp.popup.button.primary' },
                  click: {
                    actionId: 'book-appointment',
                    onSuccess: {
                      actionType: 'showPopup',
                      popup: {
                        packageName: 'hospital',
                        pageId: 'appointment-success-popup',
                        title: 'Appointment Success'
                      }
                    }
                  }
                }
              }
            ]
          }
        }
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'appointment-success-popup',
    title: 'Appointment Success',
    container: {
      layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-6'] },
      children: [
        {
          id: 'hospital-appointment-success-header',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.popup.header',
            children: [
              {
                id: 'hospital-appointment-success-title',
                type: 'text',
                config: { text: 'Appointment Created', styles: { styleTemplate: 'hosp.popup.header.title' } }
              }
            ]
          }
        },
        {
          id: 'hospital-appointment-success-message',
          type: 'text',
          config: {
            text: 'The appointment got successfully created. Please view your dashboard to see the info about the appointment.',
            styles: { styleTemplate: 'hosp.section.subheading', utilityClasses: 'block text-center' }
          }
        },
        {
          id: 'hospital-appointment-success-actions',
          type: 'container',
          config: {
            layout: { type: 'flex', flex: ['flex', 'justify-center', 'items-center'] },
            children: [
              {
                id: 'hospital-appointment-success-ok',
                type: 'button',
                config: {
                  text: 'Ok',
                  styles: { styleTemplate: 'hosp.popup.button.primary' },
                  click: { actionType: 'closePopup' }
                }
              }
            ]
          }
        }
      ]
    }
  }
  ,
  {
    packageName: 'hospital',
    pageId: 'chat',
    title: 'Chat',
    initializeActions: [{ actionId: 'chat-connect' }],
    container: {
      layoutTemplate: 'hosp.page.root',
      children: [
        {
          id: 'hospital-chat-header',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.header.shell',
            styles: { styleTemplate: 'hosp.header.card' },
            children: [
              {
                id: 'hospital-chat-header-brand',
                type: 'container',
                config: {
                  layoutTemplate: 'hosp.header.brand',
                  children: [
                    {
                      id: 'hospital-chat-header-title',
                      type: 'text',
                      config: { text: 'Chat', styles: { styleTemplate: 'hosp.header.title' } }
                    }
                  ]
                }
              },
              {
                id: 'hospital-chat-header-actions',
                type: 'container',
                config: {
                  layoutTemplate: 'hosp.header.actions',
                  children: [
                    {
                      id: 'hospital-chat-header-home',
                      type: 'button',
                      config: {
                        text: 'Home',
                        styles: { styleTemplate: 'hosp.header.menuButton' },
                        click: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'home' } }
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        {
          id: 'hospital-chat-body',
          type: 'container',
          config: {
            styles: { utilityClasses: 'px-4 sm:px-6 md:px-8 py-6' },
            children: [
              {
                id: 'hospital-chat-root',
                type: 'chat',
                config: {
                  startChatAction: { actionId: 'chat-start' },
                  acceptSupportRequestAction: { actionId: 'chat-support-accept' },
                  rejectSupportRequestAction: { actionId: 'chat-support-reject' },
                  sendMessageAction: { actionId: 'chat-send-message' },
                  supportUserId: 'support',
                  autoStart: false
                }
              }
            ]
          }
        }
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'chat-popup',
    title: 'Chat',
    initializeActions: [{ actionId: 'chat-connect' }],
    container: {
      layout: { type: 'flex', flex: ['flex', 'flex-col', 'h-full', 'min-h-0'] },
      children: [
        {
          id: 'hospital-chat-popup-header',
          type: 'container',
          config: {
            layout: { type: 'flex', flex: ['flex', 'items-center', 'justify-between'] },
            styles: { utilityClasses: 'px-4 py-3 border-b border-slate-200 bg-white' },
            children: [
              {
                id: 'hospital-chat-popup-title',
                type: 'text',
                config: {
                  text: 'Ask a question',
                  styles: { utilityClasses: 'text-base font-semibold text-slate-900' }
                }
              },
              {
                id: 'hospital-chat-popup-close',
                type: 'button',
                config: {
                  text: 'X',
                  styles: { utilityClasses: 'rounded-full px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100' },
                  click: { actionType: 'closePopup' }
                }
              }
            ]
          }
        },
        {
          id: 'hospital-chat-popup-body-shell',
          type: 'container',
          config: {
            styles: { utilityClasses: 'flex-1 min-h-0' },
            children: [
              {
                id: 'hospital-chat-popup-body',
                type: 'chat',
                config: {
                  startChatAction: { actionId: 'chat-start' },
                  acceptSupportRequestAction: { actionId: 'chat-support-accept' },
                  rejectSupportRequestAction: { actionId: 'chat-support-reject' },
                  sendMessageAction: { actionId: 'chat-send-message' },
                  supportUserId: 'support',
                  autoStart: false,
                  embedded: true,
                  styles: { utilityClasses: 'w-full h-full min-h-0' }
                }
              }
            ]
          }
        }
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'video-call-popup',
    title: 'Video Call',
    initializeActions: [{ actionId: 'call-connect' }],
    container: {
      layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-4'] },
      children: [
        {
          id: 'hospital-video-call-popup-header',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.popup.header',
            children: [
              {
                id: 'hospital-video-call-popup-title',
                type: 'text',
                config: { text: 'Video Call', styles: { styleTemplate: 'hosp.popup.header.title' } }
              },
              {
                id: 'hospital-video-call-popup-close',
                type: 'button',
                config: {
                  text: 'X',
                  styles: { styleTemplate: 'hosp.popup.header.closeButton' },
                  click: { actionType: 'closePopup' }
                }
              }
            ]
          }
        },
        {
          id: 'hospital-video-call-popup-body',
          type: 'video-call',
          config: {
            acceptAction: { actionId: 'call-accept' },
            rejectAction: { actionId: 'call-reject' },
            endAction: { actionId: 'call-end' },
            heartbeatAction: { actionId: 'call-heartbeat' }
          }
        }
      ]
    }
  }
];
