import type { PageConfig } from '../../core/types/PageConfig';
import { hospitalBookAppointmentPage, hospitalBookAppointmentPopupPage } from './bookAppointmentPage';
import { hospitalEprescriptionPopupPage } from './eprescriptionPopupPage';
import { hospitalProfilePage } from './profilePage';
import { hospitalTermsPage } from './termsPage';
import { hospitalPrivacyPage } from './privacyPage';
import {
  disabledWhenLoggedInAsDoctor,
  hospitalPublicChromeTop,
  hospitalSiteFooter
} from './hospitalPublicChrome';

const todayDateInputValue = new Date().toISOString().split('T')[0] ?? '';

export const hospitalPages: PageConfig[] = [
  {
    packageName: 'hospital',
    pageId: 'home',
    title: 'Agastya Healthcare Hospital',
    initializeActions: [
      { actionId: 'set-home-header-active' },
      { actionId: 'load-home-content' },
      { actionId: 'resolve-hero-youtube-video' },
      { actionId: 'load-doctors' }
    ],
    container: {
      layoutTemplate: 'hosp.page.root',
      children: [
        ...hospitalPublicChromeTop,
        {
          id: 'hospital-home-main',
          type: 'container',
          config: {
            styles: { utilityClasses: 'w-full flex-1 min-h-0 flex flex-col gap-6 sm:gap-8' },
            children: [
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
                            disabledCondition: disabledWhenLoggedInAsDoctor,
                            config: {
                              text: 'Schedule Visit',
                              styles: { styleTemplate: 'hosp.button.primary' },
                              click: { actionId: 'open-appointment-popup' }
                            }
                          },
                          // {
                          //   id: 'hospital-home-hero-secondary-cta',
                          //   type: 'button',
                          //   config: {
                          //     text: 'Emergency Care',
                          //     styles: { styleTemplate: 'hosp.button.secondary' }
                          //   }
                          // },
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
                id: 'hospital-home-hero-media',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'flex-col', 'w-full', 'min-h-0', 'min-w-0'] },
                  children: [
                    {
                      id: 'hospital-home-hero-youtube',
                      type: 'youtube-embed',
                      condition: {
                        expression: "heroVideoId && String(heroVideoId).trim().length > 0",
                        mappings: {
                          heroVideoId: {
                            packageName: 'hospital',
                            key: 'HomeContent',
                            path: 'hero',
                            property: 'videoId'
                          }
                        }
                      },
                      config: {
                        mapping: { packageName: 'hospital', key: 'HomeContent', path: 'hero', property: 'videoId' },
                        aspectModeMapping: {
                          packageName: 'hospital',
                          key: 'HomeContent',
                          path: 'hero',
                          property: 'videoKind'
                        },
                        styles: { styleTemplate: 'hosp.hero.youtube' },
                        title: 'Featured video from Agastya Healthcare'
                      }
                    }
                  ]
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
          id: 'hospital-home-highlights-section',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.section.stack',
            styles: { styleTemplate: 'hosp.section.card' },
            children: [
              {
                id: 'hospital-home-highlights-heading',
                type: 'text',
                config: { text: 'Why Choose Agastya Healthcare?', styles: { styleTemplate: 'hosp.section.heading' } }
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
        // {
        //   id: 'hospital-home-booking-form-section',
        //   type: 'container',
        //   config: {
        //     layoutTemplate: 'hosp.section.stack',
        //     styles: { styleTemplate: 'hosp.section.card' },
        //     children: [
        //       {
        //         id: 'hospital-book-appointment-page-heading',
        //         type: 'text',
        //         config: { text: 'Schedule a Consultation', styles: { styleTemplate: 'hosp.section.heading' } }
        //       },
        //       {
        //         id: 'hospital-home-booking-form-grid',
        //         type: 'container',
        //         config: {
        //           layoutTemplate: 'hosp.form.grid',
        //           children: [
        //             {
        //               id: 'hospital-book-appointment-doctor-select',
        //               type: 'dropdown',
        //               config: {
        //                 label: 'Select Doctor',
        //                 mapping: { packageName: 'hospital', key: 'Doctors', property: 'list' },
        //                 styles: { styleTemplate: 'hosp.form.input' }
        //               }
        //             },
        //             {
        //               id: 'hospital-book-appointment-preferred-date',
        //               type: 'input',
        //               config: {
        //                 label: 'Preferred Date',
        //                 inputType: 'date',
        //                 styles: { styleTemplate: 'hosp.form.input' }
        //               }
        //             }
        //           ]
        //         }
        //       },
        //       {
        //         id: 'hospital-book-appointment-submit',
        //         type: 'button',
        //         disabledCondition: disabledWhenLoggedInAsDoctor,
        //         config: {
        //           text: 'Book Appointment',
        //           styles: { styleTemplate: 'hosp.button.primary' },
        //           click: { actionId: 'open-appointment-popup' }
        //         }
        //       }
        //     ]
        //   }
        // },
        {
          id: 'hospital-home-contact-section',
          type: 'container',
          domId: 'hospital-home-contact-section',
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
                id: 'hospital-home-contact-phone',
                type: 'text',
                config: {
                  mapping: { packageName: 'hospital', key: 'HomeContent', path: 'contact', property: 'whatsapp' },
                  styles: { styleTemplate: 'hosp.contact.block' }
                }
              },
              {
                id: 'hospital-home-contact-phone',
                type: 'text',
                config: {
                  mapping: { packageName: 'hospital', key: 'HomeContent', path: 'contact', property: 'email' },
                  styles: { styleTemplate: 'hosp.contact.block' }
                }
              }
            ]
          }
        }
            ]
          }
        },
        hospitalSiteFooter(
          'hospital-home-footer',
          'Agastya Healthcare | Pediatric and family care you can trust.'
        )
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'dashboard',
    title: 'Dashboard',
    initializeActions: [
      { actionId: 'set-dashboard-header-active' },
      { actionId: 'load-home-content' },
      { actionId: 'load-doctors' },
      { actionId: 'init-dashboard' }
    ],
    container: {
      layoutTemplate: 'hosp.page.root',
      children: [
        {
          id: 'hospital-dashboard-header',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.header.shell',
            styles: { styleTemplate: 'hosp.header.card' },
            children: [
              {
                id: 'hospital-dashboard-header-lead',
                type: 'container',
                config: {
                  layoutTemplate: 'hosp.header.lead',
                  children: [
                    {
                      id: 'hospital-dashboard-header-mobile-menu-slot',
                      type: 'container',
                      config: {
                        styles: { utilityClasses: 'w-10 shrink-0 flex items-center justify-center' },
                        children: [
                          {
                            id: 'hospital-dashboard-header-mobile-menu-toggle-left',
                            type: 'button',
                            config: {
                              text: '☰',
                              title: 'Menu',
                              styles: {
                                utilityClasses:
                                  'inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 lg:invisible'
                              },
                              click: { actionId: 'toggle-header-menu' }
                            }
                          }
                        ]
                      }
                    },
                    {
                      id: 'hospital-dashboard-header-brand',
                      type: 'container',
                      config: {
                        layoutTemplate: 'hosp.header.brand',
                        children: [
                          {
                            id: 'hospital-dashboard-header-logo',
                            type: 'image',
                            config: {
                              src: 'https://res.cloudinary.com/dbke33vfd/image/upload/v1776158879/logo_oz0zzd.jpg',
                              alt: 'Agastya Healthcare logo',
                              styles: { styleTemplate: 'hosp.header.logo' },
                              click: {
                                actionId: 'set-home-header-active',
                                onSuccess: {
                                  actionType: 'navigate',
                                  navigate: { packageName: 'hospital', pageId: 'home' }
                                }
                              }
                            }
                          },
                          {
                            id: 'hospital-dashboard-header-title',
                            type: 'text',
                            config: {
                              text: 'Agastya Healthcare',
                              styles: { styleTemplate: 'hosp.header.title' },
                              plainClick: true,
                              click: {
                                actionId: 'set-home-header-active',
                                onSuccess: {
                                  actionType: 'navigate',
                                  navigate: { packageName: 'hospital', pageId: 'home' }
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
                id: 'hospital-dashboard-header-nav',
                type: 'container',
                config: {
                  layoutTemplate: 'hosp.header.nav',
                  styles: { utilityClasses: 'hidden lg:flex items-center gap-4' },
                  children: [
                    {
                      id: 'hospital-dashboard-header-nav-home-active',
                      type: 'button',
                      condition: {
                        expression: "activeMenu === 'HOME'",
                        mappings: {
                          activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                        }
                      },
                      config: {
                        text: 'Home',
                        styles: {
                          styleTemplate: 'hosp.header.menuButton',
                          utilityClasses: 'bg-emerald-100 text-emerald-700'
                        },
                        click: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'home' } }
                      }
                    },
                    {
                      id: 'hospital-dashboard-header-nav-home',
                      type: 'button',
                      condition: {
                        expression: "activeMenu !== 'HOME'",
                        mappings: {
                          activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                        }
                      },
                      config: {
                        text: 'Home',
                        styles: { styleTemplate: 'hosp.header.menuButton' },
                        click: {
                          actionId: 'set-home-header-active',
                          onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'home' } }
                        }
                      }
                    },
                    {
                      id: 'hospital-dashboard-header-nav-dashboard-active',
                      type: 'button',
                      condition: {
                        expression: "activeMenu === 'DASHBOARD'",
                        mappings: {
                          activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                        }
                      },
                      config: {
                        text: 'Dashboard',
                        styles: {
                          styleTemplate: 'hosp.header.menuButton',
                          utilityClasses: 'bg-emerald-100 text-emerald-700'
                        },
                        click: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'dashboard' } }
                      }
                    },
                    {
                      id: 'hospital-dashboard-header-nav-dashboard',
                      type: 'button',
                      condition: {
                        expression: "activeMenu !== 'DASHBOARD'",
                        mappings: {
                          activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                        }
                      },
                      config: {
                        text: 'Dashboard',
                        styles: { styleTemplate: 'hosp.header.menuButton' },
                        click: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'dashboard' } }
                      }
                    },
                    {
                      id: 'hospital-dashboard-header-nav-education-active',
                      type: 'button',
                      condition: {
                        expression:
                          "String(role ?? '').toUpperCase() === 'DOCTOR' && activeMenu === 'EDUCATION'",
                        mappings: {
                          role: { packageName: 'hospital', key: 'AuthSession', property: 'role' },
                          activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                        }
                      },
                      config: {
                        text: 'Education',
                        styles: {
                          styleTemplate: 'hosp.header.menuButton',
                          utilityClasses: 'bg-emerald-100 text-emerald-700'
                        },
                        click: {
                          actionId: 'set-education-header-active',
                          onSuccess: {
                            actionType: 'navigate',
                            navigate: { packageName: 'hospital', pageId: 'doctor-education' }
                          }
                        }
                      }
                    },
                    {
                      id: 'hospital-dashboard-header-nav-education',
                      type: 'button',
                      condition: {
                        expression:
                          "String(role ?? '').toUpperCase() === 'DOCTOR' && activeMenu !== 'EDUCATION'",
                        mappings: {
                          role: { packageName: 'hospital', key: 'AuthSession', property: 'role' },
                          activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                        }
                      },
                      config: {
                        text: 'Education',
                        styles: { styleTemplate: 'hosp.header.menuButton' },
                        click: {
                          actionId: 'set-education-header-active',
                          onSuccess: {
                            actionType: 'navigate',
                            navigate: { packageName: 'hospital', pageId: 'doctor-education' }
                          }
                        }
                      }
                    },
                    {
                      id: 'hospital-dashboard-header-nav-blog-active',
                      type: 'button',
                      condition: {
                        expression: "activeMenu === 'BLOG'",
                        mappings: {
                          activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                        }
                      },
                      config: {
                        text: 'Blog',
                        styles: {
                          styleTemplate: 'hosp.header.menuButton',
                          utilityClasses: 'bg-emerald-100 text-emerald-700'
                        },
                        click: {
                          actionId: 'set-blog-header-active',
                          onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'blog' } }
                        }
                      }
                    },
                    {
                      id: 'hospital-dashboard-header-nav-blog',
                      type: 'button',
                      condition: {
                        expression: "activeMenu !== 'BLOG'",
                        mappings: {
                          activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                        }
                      },
                      config: {
                        text: 'Blog',
                        styles: { styleTemplate: 'hosp.header.menuButton' },
                        click: {
                          actionId: 'set-blog-header-active',
                          onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'blog' } }
                        }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-dashboard-header-actions',
                type: 'container',
                config: {
                  layoutTemplate: 'hosp.header.actions',
                  children: [
                    {
                      id: 'hospital-dashboard-header-login',
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
                        text: 'Login/Register',
                        styles: { styleTemplate: 'hosp.header.authButton' },
                        click: { actionId: 'open-login-popup' }
                      }
                    },
                    {
                      id: 'hospital-dashboard-header-user-anchor',
                      type: 'container',
                      condition: {
                        expression: "userId && String(userId).trim().length > 0",
                        mappings: {
                          userId: { packageName: 'hospital', key: 'AuthSession', property: 'userId' }
                        }
                      },
                      config: {
                        styles: { utilityClasses: 'relative hidden md:block' },
                        rootAttrs: { 'data-profile-menu-root': true },
                        children: [
                          {
                            id: 'hospital-dashboard-header-user-display',
                            type: 'button',
                            config: {
                              mapping: { packageName: 'hospital', key: 'AuthSession', property: 'userDisplayName' },
                              styles: { styleTemplate: 'hosp.header.userButton' },
                              trailingVisual: 'chevron-down',
                              title: 'Account menu — profile, account status, sign out',
                              click: { actionId: 'toggle-profile-header-menu' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-header-user-menu',
                            type: 'container',
                            condition: {
                              expression: 'profileMenuOpen',
                              mappings: {
                                profileMenuOpen: { packageName: 'hospital', key: 'HeaderUiState', property: 'profileMenuOpen' }
                              }
                            },
                            config: {
                              styles: {
                                utilityClasses:
                                  'absolute left-0 top-[calc(100%+6px)] z-30 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-md'
                              },
                              children: [
                                {
                                  id: 'hospital-dashboard-header-user-menu-profile',
                                  type: 'button',
                                  config: {
                                    text: 'Profile',
                                    styles: { styleTemplate: 'hosp.header.menuButton' },
                                    click: {
                                      actionId: 'set-profile-page-section',
                                      data: { section: 'profile' },
                                      onSuccess: {
                                        actionId: 'set-profile-header-active',
                                        onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'profile' } }
                                      }
                                    }
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-header-user-menu-inactive',
                                  type: 'button',
                                  config: {
                                    text: 'Inactive Account',
                                    styles: { styleTemplate: 'hosp.header.menuButton' },
                                    click: {
                                      actionId: 'set-profile-page-section',
                                      data: { section: 'inactive' },
                                      onSuccess: {
                                        actionId: 'set-profile-header-active',
                                        onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'profile' } }
                                      }
                                    }
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-header-user-menu-logout',
                                  type: 'button',
                                  config: {
                                    text: 'Sign out',
                                    pendingLabel: 'Signing out…',
                                    styles: { styleTemplate: 'hosp.header.menuButton' },
                                    click: { actionId: 'logout-user' }
                                  }
                                }
                              ]
                            }
                          }
                        ]
                      }
                    },
                    {
                      id: 'hospital-dashboard-header-user-anchor-mobile',
                      type: 'container',
                      condition: {
                        expression: "userId && String(userId).trim().length > 0",
                        mappings: {
                          userId: { packageName: 'hospital', key: 'AuthSession', property: 'userId' }
                        }
                      },
                      config: {
                        styles: { utilityClasses: 'relative md:hidden' },
                        rootAttrs: { 'data-profile-menu-root': true },
                        children: [
                          {
                            id: 'hospital-dashboard-header-user-display-mobile',
                            type: 'button',
                            config: {
                              mapping: { packageName: 'hospital', key: 'AuthSession', property: 'userDisplayName' },
                              mappingMaxLength: 50,
                              textFallback: 'Account',
                              trailingVisual: 'chevron-down',
                              styles: {
                                styleTemplate: 'hosp.header.userMenuTriggerMobile',
                                utilityClasses: 'min-w-0 max-w-[18ch] sm:max-w-[22ch] truncate'
                              },
                              title: 'Account menu — profile, account status, sign out',
                              click: { actionId: 'toggle-profile-header-menu' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-header-user-menu-mobile',
                            type: 'container',
                            condition: {
                              expression: 'profileMenuOpen',
                              mappings: {
                                profileMenuOpen: { packageName: 'hospital', key: 'HeaderUiState', property: 'profileMenuOpen' }
                              }
                            },
                            config: {
                              styles: {
                                utilityClasses:
                                  'absolute left-0 top-[calc(100%+6px)] z-30 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-md'
                              },
                              children: [
                                {
                                  id: 'hospital-dashboard-header-user-menu-profile-mobile',
                                  type: 'button',
                                  config: {
                                    text: 'Profile',
                                    styles: { styleTemplate: 'hosp.header.menuButton' },
                                    click: {
                                      actionId: 'set-profile-page-section',
                                      data: { section: 'profile' },
                                      onSuccess: {
                                        actionId: 'set-profile-header-active',
                                        onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'profile' } }
                                      }
                                    }
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-header-user-menu-inactive-mobile',
                                  type: 'button',
                                  config: {
                                    text: 'Inactive Account',
                                    styles: { styleTemplate: 'hosp.header.menuButton' },
                                    click: {
                                      actionId: 'set-profile-page-section',
                                      data: { section: 'inactive' },
                                      onSuccess: {
                                        actionId: 'set-profile-header-active',
                                        onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'profile' } }
                                      }
                                    }
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-header-user-menu-logout-mobile',
                                  type: 'button',
                                  config: {
                                    text: 'Sign out',
                                    pendingLabel: 'Signing out…',
                                    styles: { styleTemplate: 'hosp.header.menuButton' },
                                    click: { actionId: 'logout-user' }
                                  }
                                }
                              ]
                            }
                          }
                        ]
                      }
                    },
                    {
                      id: 'hospital-dashboard-header-cta',
                      type: 'button',
                      disabledCondition: disabledWhenLoggedInAsDoctor,
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
          id: 'hospital-dashboard-mobile-menu-panel',
          type: 'container',
          condition: {
            expression: 'headerMenuOpen !== false',
            mappings: {
              headerMenuOpen: { packageName: 'hospital', key: 'ResponsiveUiState', property: 'headerMenuOpen' }
            }
          },
          config: {
            styles: { utilityClasses: 'lg:hidden rounded-xl border border-slate-200 bg-white px-3 py-2' },
            children: [
              {
                id: 'hospital-dashboard-mobile-menu-home-active',
                type: 'button',
                condition: {
                  expression: "activeMenu === 'HOME'",
                  mappings: {
                    activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                  }
                },
                config: {
                  text: 'Home',
                  styles: { styleTemplate: 'hosp.header.menuButtonActive' },
                  click: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'home' } }
                }
              },
              {
                id: 'hospital-dashboard-mobile-menu-home',
                type: 'button',
                condition: {
                  expression: "activeMenu !== 'HOME'",
                  mappings: {
                    activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                  }
                },
                config: {
                  text: 'Home',
                  styles: { styleTemplate: 'hosp.header.menuButton' },
                  click: {
                    actionId: 'set-home-header-active',
                    onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'home' } }
                  }
                }
              },
              {
                id: 'hospital-dashboard-mobile-menu-dashboard-active',
                type: 'button',
                condition: {
                  expression: "activeMenu === 'DASHBOARD'",
                  mappings: {
                    activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                  }
                },
                config: {
                  text: 'Dashboard',
                  styles: { styleTemplate: 'hosp.header.menuButtonActive' },
                  click: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'dashboard' } }
                }
              },
              {
                id: 'hospital-dashboard-mobile-menu-dashboard',
                type: 'button',
                condition: {
                  expression: "activeMenu !== 'DASHBOARD'",
                  mappings: {
                    activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                  }
                },
                config: {
                  text: 'Dashboard',
                  styles: { styleTemplate: 'hosp.header.menuButton' },
                  click: { actionId: 'set-dashboard-header-active' }
                }
              },
              {
                id: 'hospital-dashboard-mobile-menu-education-active',
                type: 'button',
                condition: {
                  expression: "String(role ?? '').toUpperCase() === 'DOCTOR' && activeMenu === 'EDUCATION'",
                  mappings: {
                    role: { packageName: 'hospital', key: 'AuthSession', property: 'role' },
                    activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                  }
                },
                config: {
                  text: 'Education',
                  styles: { styleTemplate: 'hosp.header.menuButtonActive' },
                  click: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'doctor-education' } }
                }
              },
              {
                id: 'hospital-dashboard-mobile-menu-education',
                type: 'button',
                condition: {
                  expression: "String(role ?? '').toUpperCase() === 'DOCTOR' && activeMenu !== 'EDUCATION'",
                  mappings: {
                    role: { packageName: 'hospital', key: 'AuthSession', property: 'role' },
                    activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                  }
                },
                config: {
                  text: 'Education',
                  styles: { styleTemplate: 'hosp.header.menuButton' },
                  click: {
                    actionId: 'set-education-header-active',
                    onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'doctor-education' } }
                  }
                }
              },
              {
                id: 'hospital-dashboard-mobile-menu-blog-active',
                type: 'button',
                condition: {
                  expression: "activeMenu === 'BLOG'",
                  mappings: {
                    activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                  }
                },
                config: {
                  text: 'Blog',
                  styles: { styleTemplate: 'hosp.header.menuButtonActive' },
                  click: {
                    actionId: 'set-blog-header-active',
                    onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'blog' } }
                  }
                }
              },
              {
                id: 'hospital-dashboard-mobile-menu-blog',
                type: 'button',
                condition: {
                  expression: "activeMenu !== 'BLOG'",
                  mappings: {
                    activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                  }
                },
                config: {
                  text: 'Blog',
                  styles: { styleTemplate: 'hosp.header.menuButton' },
                  click: {
                    actionId: 'set-blog-header-active',
                    onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'blog' } }
                  }
                }
              }
            ]
          }
        },
        {
          id: 'hospital-dashboard-content-shell',
          type: 'container',
          config: {
            layout: { type: 'grid', grid: ['grid', 'grid-cols-12', 'gap-4', 'items-start'] },
            styles: { utilityClasses: 'w-full flex-1 min-h-0' },
            children: [
              {
                id: 'hospital-dashboard-left-menu',
                type: 'container',
                config: {
                  styles: {
                    utilityClasses:
                      'col-span-12 lg:col-span-2 rounded-xl border border-slate-200 bg-white p-3 space-y-2'
                  },
                  children: [
                    {
                      id: 'hospital-dashboard-menu-appointments-active',
                      type: 'button',
                      condition: {
                        expression: "String(activeItem ?? '') === 'appointments'",
                        mappings: {
                          activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
                        }
                      },
                      config: {
                        text: 'Appointments',
                        styles: {
                          utilityClasses:
                            'w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-800 shadow-sm'
                        },
                        click: {
                          actionId: 'require-hospital-dashboard-session',
                          data: { tab: 'appointments' },
                          onSuccess: {
                            actionId: 'set-dashboard-nav-appointments',
                            onSuccess: {
                              actionId: 'set-dashboard-header-active'
                            }
                          }
                        }
                      }
                    },
                    {
                      id: 'hospital-dashboard-menu-appointments-inactive',
                      type: 'button',
                      condition: {
                        expression: "String(activeItem ?? '') !== 'appointments'",
                        mappings: {
                          activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
                        }
                      },
                      config: {
                        text: 'Appointments',
                        styles: {
                          utilityClasses:
                            'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50'
                        },
                        click: {
                          actionId: 'require-hospital-dashboard-session',
                          data: { tab: 'appointments' },
                          onSuccess: {
                            actionId: 'set-dashboard-nav-appointments',
                            onSuccess: {
                              actionId: 'set-dashboard-header-active'
                            }
                          }
                        }
                      }
                    },
                    {
                      id: 'hospital-dashboard-menu-working-slots-active',
                      type: 'button',
                      condition: {
                        expression:
                          "(String(role ?? '').toUpperCase() === 'ADMIN' || String(role ?? '').toUpperCase() === 'DOCTOR') && String(activeItem ?? '') === 'working-slots'",
                        mappings: {
                          role: { packageName: 'hospital', key: 'AuthSession', property: 'role' },
                          activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
                        }
                      },
                      config: {
                        text: 'Set working time slots',
                        styles: {
                          utilityClasses:
                            'w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-800 shadow-sm'
                        },
                        click: {
                          actionId: 'require-hospital-dashboard-session',
                          data: { tab: 'working-slots' },
                          onSuccess: {
                            actionId: 'set-dashboard-nav-working-slots',
                            onSuccess: {
                              actionId: 'set-dashboard-header-active',
                              onSuccess: {
                                actionId: 'init-doctor-working-slots'
                              }
                            }
                          }
                        }
                      }
                    },
                    {
                      id: 'hospital-dashboard-menu-working-slots-inactive',
                      type: 'button',
                      condition: {
                        expression:
                          "(String(role ?? '').toUpperCase() === 'ADMIN' || String(role ?? '').toUpperCase() === 'DOCTOR') && String(activeItem ?? '') !== 'working-slots'",
                        mappings: {
                          role: { packageName: 'hospital', key: 'AuthSession', property: 'role' },
                          activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
                        }
                      },
                      config: {
                        text: 'Set working time slots',
                        styles: {
                          utilityClasses:
                            'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50'
                        },
                        click: {
                          actionId: 'require-hospital-dashboard-session',
                          data: { tab: 'working-slots' },
                          onSuccess: {
                            actionId: 'set-dashboard-nav-working-slots',
                            onSuccess: {
                              actionId: 'set-dashboard-header-active',
                              onSuccess: {
                                actionId: 'init-doctor-working-slots'
                              }
                            }
                          }
                        }
                      }
                    },
                    {
                      id: 'hospital-dashboard-menu-admin-active',
                      type: 'button',
                      condition: {
                        expression:
                          "String(role ?? '').toUpperCase() === 'ADMIN' && String(activeItem ?? '') === 'admin'",
                        mappings: {
                          role: { packageName: 'hospital', key: 'AuthSession', property: 'role' },
                          activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
                        }
                      },
                      config: {
                        text: 'Administration',
                        styles: {
                          utilityClasses:
                            'w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-sm font-semibold text-emerald-800 shadow-sm'
                        },
                        click: {
                          actionId: 'require-hospital-dashboard-session',
                          data: { tab: 'admin' },
                          onSuccess: {
                            actionId: 'set-dashboard-nav-admin',
                            onSuccess: {
                              actionId: 'init-admin-dashboard',
                              onSuccess: { actionId: 'set-dashboard-header-active' }
                            }
                          }
                        }
                      }
                    },
                    {
                      id: 'hospital-dashboard-menu-admin-inactive',
                      type: 'button',
                      condition: {
                        expression:
                          "String(role ?? '').toUpperCase() === 'ADMIN' && String(activeItem ?? '') !== 'admin'",
                        mappings: {
                          role: { packageName: 'hospital', key: 'AuthSession', property: 'role' },
                          activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
                        }
                      },
                      config: {
                        text: 'Administration',
                        styles: {
                          utilityClasses:
                            'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50'
                        },
                        click: {
                          actionId: 'require-hospital-dashboard-session',
                          data: { tab: 'admin' },
                          onSuccess: {
                            actionId: 'set-dashboard-nav-admin',
                            onSuccess: {
                              actionId: 'init-admin-dashboard',
                              onSuccess: { actionId: 'set-dashboard-header-active' }
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-dashboard-main',
                type: 'container',
                config: {
                  styles: { utilityClasses: 'col-span-12 lg:col-span-10 rounded-xl border border-slate-200 bg-white p-4 space-y-4' },
                  children: [
                    {
                      id: 'hospital-dashboard-panel-appointments',
                      type: 'container',
                      condition: {
                        expression: "String(activeItem ?? '') === 'appointments'",
                        mappings: {
                          activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
                        }
                      },
                      config: {
                        styles: { utilityClasses: 'space-y-4' },
                        children: [
                    {
                      id: 'hospital-dashboard-main-title-row',
                      type: 'container',
                      config: {
                        layout: { type: 'flex', flex: ['flex', 'items-center', 'justify-between', 'gap-3', 'flex-wrap'] },
                        children: [
                          {
                            id: 'hospital-dashboard-main-title',
                            type: 'text',
                            config: { text: 'Appointments', styles: { styleTemplate: 'hosp.section.heading' } }
                          },
                          {
                            id: 'hospital-dashboard-main-total',
                            type: 'text',
                            config: {
                              mapping: { packageName: 'hospital', key: 'DashboardAppointments', property: 'totalLabel' },
                              styles: { utilityClasses: 'text-sm font-semibold text-slate-600' }
                            }
                          }
                        ]
                      }
                    },
                    {
                      id: 'hospital-dashboard-filter-toggle-mobile',
                      type: 'button',
                      config: {
                        text: '⚙️ Filters',
                        title: 'Toggle filters',
                        styles: {
                          utilityClasses:
                            'inline-flex lg:hidden w-fit rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700'
                        },
                        click: { actionId: 'toggle-dashboard-filters' }
                      }
                    },
                    {
                      id: 'hospital-dashboard-filter-grid-mobile',
                      type: 'container',
                      condition: {
                        expression: 'dashboardFiltersOpen',
                        mappings: {
                          dashboardFiltersOpen: {
                            packageName: 'hospital',
                            key: 'ResponsiveUiState',
                            property: 'dashboardFiltersOpen'
                          }
                        }
                      },
                      config: {
                        styles: { utilityClasses: 'grid grid-cols-1 gap-3 lg:hidden' },
                        children: [
                          {
                            id: 'hospital-dashboard-filter-status-mobile',
                            type: 'dropdown',
                            config: {
                              label: 'Status',
                              mapping: { packageName: 'hospital', key: 'DashboardFilters', property: 'statusOptions' },
                              styles: { styleTemplate: 'hosp.form.input' },
                              change: { actionId: 'set-dashboard-filter-status' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-filter-date-mobile',
                            type: 'input',
                            config: {
                              label: 'Date',
                              inputType: 'date',
                              styles: { styleTemplate: 'hosp.form.input' },
                              change: { actionId: 'set-dashboard-filter-date' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-filter-doctor-mobile',
                            type: 'dropdown',
                            config: {
                              label: 'Doctor',
                              mapping: { packageName: 'hospital', key: 'DashboardFilters', property: 'doctorOptions' },
                              styles: { styleTemplate: 'hosp.form.input' },
                              change: { actionId: 'set-dashboard-filter-doctor' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-filter-department-mobile',
                            type: 'dropdown',
                            config: {
                              label: 'Department',
                              mapping: { packageName: 'hospital', key: 'DashboardFilters', property: 'departmentOptions' },
                              styles: { styleTemplate: 'hosp.form.input' },
                              change: { actionId: 'set-dashboard-filter-department' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-filter-actions-mobile',
                            type: 'container',
                            config: {
                              layout: { type: 'flex', flex: ['flex', 'justify-end', 'items-end'] },
                              children: [
                                {
                                  id: 'hospital-dashboard-filter-clear-mobile',
                                  type: 'button',
                                  config: {
                                    text: '↺',
                                    title: 'Clear filters',
                                    styles: {
                                      utilityClasses:
                                        'inline-flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-600 bg-white text-xl font-semibold text-emerald-700'
                                    },
                                    click: { actionId: 'clear-dashboard-filters' }
                                  }
                                }
                              ]
                            }
                          }
                        ]
                      }
                    },
                    {
                      id: 'hospital-dashboard-filter-grid',
                      type: 'container',
                      config: {
                        styles: {
                          utilityClasses: 'hidden lg:grid lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] items-end gap-3'
                        },
                        children: [
                          {
                            id: 'hospital-dashboard-filter-status',
                            type: 'dropdown',
                            config: {
                              label: 'Status',
                              mapping: { packageName: 'hospital', key: 'DashboardFilters', property: 'statusOptions' },
                              styles: { styleTemplate: 'hosp.form.input' },
                              change: { actionId: 'set-dashboard-filter-status' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-filter-date',
                            type: 'input',
                            config: {
                              label: 'Date',
                              inputType: 'date',
                              styles: { styleTemplate: 'hosp.form.input' },
                              change: { actionId: 'set-dashboard-filter-date' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-filter-doctor',
                            type: 'dropdown',
                            config: {
                              label: 'Doctor',
                              mapping: { packageName: 'hospital', key: 'DashboardFilters', property: 'doctorOptions' },
                              styles: { styleTemplate: 'hosp.form.input' },
                              change: { actionId: 'set-dashboard-filter-doctor' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-filter-department',
                            type: 'dropdown',
                            config: {
                              label: 'Department',
                              mapping: { packageName: 'hospital', key: 'DashboardFilters', property: 'departmentOptions' },
                              styles: { styleTemplate: 'hosp.form.input' },
                              change: { actionId: 'set-dashboard-filter-department' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-filter-actions',
                            type: 'container',
                            config: {
                              layout: { type: 'flex', flex: ['flex', 'items-end', 'justify-end'] },
                              children: [
                                {
                                  id: 'hospital-dashboard-filter-clear',
                                  type: 'button',
                                  config: {
                                    text: '↺',
                                    title: 'Clear filters',
                                    styles: {
                                      utilityClasses:
                                        'inline-flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-600 bg-white text-xl font-semibold text-emerald-700'
                                    },
                                    click: { actionId: 'clear-dashboard-filters' }
                                  }
                                }
                              ]
                            }
                          }
                        ]
                      }
                    },
                    {
                      id: 'hospital-dashboard-appointments-loading',
                      type: 'text',
                      condition: {
                        expression: 'loading',
                        mappings: {
                          loading: { packageName: 'hospital', key: 'DashboardAppointments', property: 'loading' }
                        }
                      },
                      config: {
                        text: 'Loading appointments...',
                        styles: { utilityClasses: 'text-sm font-medium text-slate-600' }
                      }
                    },
                    {
                      id: 'hospital-dashboard-appointments-error',
                      type: 'text',
                      condition: {
                        expression: 'error && String(error).trim().length > 0',
                        mappings: {
                          error: { packageName: 'hospital', key: 'DashboardAppointments', property: 'error' }
                        }
                      },
                      config: {
                        mapping: { packageName: 'hospital', key: 'DashboardAppointments', property: 'error' },
                        styles: { styleTemplate: 'hosp.form.errorText' }
                      }
                    },
                    {
                      id: 'hospital-dashboard-appointments-empty',
                      type: 'text',
                      condition: {
                        expression: '!loading && (!list || list.length === 0)',
                        mappings: {
                          loading: { packageName: 'hospital', key: 'DashboardAppointments', property: 'loading' },
                          list: { packageName: 'hospital', key: 'DashboardAppointments', property: 'list' }
                        }
                      },
                      config: {
                        text: 'No appointments found for the selected filters.',
                        styles: { utilityClasses: 'text-sm text-slate-500' }
                      }
                    },
                    {
                      id: 'hospital-dashboard-appointments-list',
                      type: 'list',
                      condition: {
                        expression: '!loading && list && list.length > 0',
                        mappings: {
                          loading: { packageName: 'hospital', key: 'DashboardAppointments', property: 'loading' },
                          list: { packageName: 'hospital', key: 'DashboardAppointments', property: 'list' }
                        }
                      },
                      config: {
                        listStyleTemplate: 'hosp.section.stack',
                        mapping: { packageName: 'hospital', key: 'DashboardAppointments', property: 'list' },
                        itemTemplate: {
                          layout: {
                            type: 'flex',
                            flex: ['flex', 'flex-row', 'items-start', 'justify-between', 'gap-3']
                          },
                          styles: { utilityClasses: 'mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3' },
                          children: [
                            {
                              id: 'hospital-dashboard-appointment-main',
                              type: 'container',
                              config: {
                                layout: {
                                  type: 'flex',
                                  flex: ['flex', 'min-w-0', 'flex-1', 'flex-col', 'gap-1', 'pr-1']
                                },
                                children: [
                                  {
                                    id: 'hospital-dashboard-appointment-line-1',
                                    type: 'text',
                                    config: {
                                      text: 'Patient: {{patientName}} | Doctor: {{doctorName}} | Status: {{statusLabel}}',
                                      styles: { utilityClasses: 'text-sm font-semibold text-slate-800' }
                                    }
                                  },
                                  {
                                    id: 'hospital-dashboard-appointment-line-2',
                                    type: 'text',
                                    config: {
                                      text: 'Date: {{preferredDate}} | Slot: {{preferredTimeSlot}} | Department: {{department}} | Phone: {{phoneNumber}} | Age: {{ageGroup}}',
                                      styles: { utilityClasses: 'text-xs text-slate-600' }
                                    }
                                  },
                                  {
                                    id: 'hospital-dashboard-appointment-additional-notes',
                                    type: 'text',
                                    condition: {
                                      expression: 'String(additionalNotes ?? "").trim().length > 0'
                                    },
                                    config: {
                                      text: 'Additional notes: {{additionalNotes}}',
                                      styles: { utilityClasses: 'text-xs text-slate-600' }
                                    }
                                  }
                                ]
                              }
                            },
                            {
                              id: 'hospital-dashboard-appointment-actions',
                              type: 'container',
                              config: {
                                layout: {
                                  type: 'flex',
                                  flex: ['flex', 'shrink-0', 'flex-row', 'items-center', 'justify-end', 'gap-2', 'flex-wrap']
                                },
                                children: [
                                  {
                                    id: 'hospital-dashboard-appointment-complete',
                                    type: 'button',
                                    condition: {
                                      expression: 'canMarkVisitComplete === "Y"'
                                    },
                                    config: {
                                      text: '✓',
                                      title: 'Mark visit complete',
                                      styles: {
                                        utilityClasses:
                                          'rounded-md border border-sky-500 px-2 py-1 text-xs leading-none text-sky-800 hover:bg-sky-50'
                                      },
                                      click: {
                                        actionId: 'complete-dashboard-visit',
                                        data: { appointmentId: '{{id}}' }
                                      }
                                    }
                                  },
                                  {
                                    id: 'hospital-dashboard-appointment-eprx',
                                    type: 'button',
                                    condition: {
                                      expression: 'canIssueEprescription === "Y"'
                                    },
                                    config: {
                                      text: 'Rx',
                                      title: 'Issue structured e-prescription',
                                      styles: {
                                        utilityClasses:
                                          'rounded-md border border-indigo-500 px-2 py-1 text-xs leading-none text-indigo-800 hover:bg-indigo-50'
                                      },
                                      click: {
                                        actionId: 'open-eprescription-popup',
                                        data: { appointmentId: '{{id}}' }
                                      }
                                    }
                                  },
                                  {
                                    id: 'hospital-dashboard-appointment-eprx-pdf',
                                    type: 'button',
                                    condition: {
                                      expression: 'canDownloadEprescription === "Y"'
                                    },
                                    config: {
                                      text: '⬇Rx',
                                      title: 'Download signed e-prescription PDF (if finalized)',
                                      styles: {
                                        utilityClasses:
                                          'rounded-md border border-indigo-400 px-2 py-1 text-xs leading-none text-indigo-800 hover:bg-indigo-50'
                                      },
                                      click: {
                                        actionId: 'download-eprescription-pdf',
                                        data: { appointmentId: '{{id}}' }
                                      }
                                    }
                                  },
                                  {
                                    id: 'hospital-dashboard-appointment-video',
                                    type: 'button',
                                    disabledCondition: {
                                      expression: 'canStartVideoCall !== "Y"'
                                    },
                                    config: {
                                      text: '📞🎥',
                                      title: 'Video Call',
                                      styles: {
                                        utilityClasses:
                                          'rounded-md border border-emerald-500 px-2 py-1 text-xs leading-none text-emerald-700 hover:bg-emerald-50'
                                      },
                                      click: {
                                        actionId: 'open-appointment-video-call',
                                        data: {
                                          appointmentId: '{{id}}',
                                          doctorId: '{{doctorId}}',
                                          createdBy: '{{createdBy}}',
                                          patientName: '{{patientName}}',
                                          doctorName: '{{doctorName}}',
                                          department: '{{department}}'
                                        }
                                      }
                                    }
                                  },
                                  {
                                    id: 'hospital-dashboard-appointment-edit',
                                    type: 'button',
                                    condition: {
                                      expression: 'canEditAppointment === "Y"'
                                    },
                                    config: {
                                      text: '✏️',
                                      title: 'Edit appointment',
                                      styles: {
                                        utilityClasses:
                                          'rounded-md border border-emerald-500 px-2 py-1 text-xs leading-none text-emerald-700 hover:bg-emerald-50'
                                      },
                                      click: {
                                        actionId: 'edit-dashboard-appointment',
                                        data: { appointmentId: '{{id}}' }
                                      }
                                    }
                                  },
                                  {
                                    id: 'hospital-dashboard-appointment-receipt',
                                    type: 'button',
                                    config: {
                                      text: '{{receiptActionIcon}}',
                                      title: 'View uploaded document images (not the structured e-prescription)',
                                      hiddenWhenEmptyText: true,
                                      styles: {
                                        utilityClasses:
                                          'rounded-md border border-emerald-500 px-2 py-1 text-xs leading-none text-emerald-700 hover:bg-emerald-50'
                                      },
                                      click: {
                                        actionId: 'open-appointment-receipt',
                                        data: { appointmentId: '{{id}}', fileId: '{{firstReceiptFileId}}' }
                                      }
                                    }
                                  },
                                  {
                                    id: 'hospital-dashboard-appointment-cancel',
                                    type: 'button',
                                    condition: {
                                      expression:
                                        'String(status ?? "").toUpperCase() !== "CANCELLED" && String(status ?? "").toUpperCase() !== "DELETED"'
                                    },
                                    config: {
                                      text: '🗑️',
                                      title: 'Cancel appointment',
                                      styles: {
                                        utilityClasses:
                                          'rounded-md border border-rose-400 px-2 py-1 text-xs leading-none text-rose-700 hover:bg-rose-50'
                                      },
                                      click: {
                                        actionId: 'cancel-dashboard-appointment',
                                        data: { appointmentId: '{{id}}' }
                                      }
                                    }
                                  }
                                ]
                              }
                            }
                          ]
                        }
                      }
                    },
                    {
                      id: 'hospital-dashboard-pagination-shell',
                      type: 'container',
                      config: {
                        layout: { type: 'flex', flex: ['flex', 'items-center', 'justify-between', 'gap-3', 'flex-wrap'] },
                        children: [
                          {
                            id: 'hospital-dashboard-pagination-meta',
                            type: 'text',
                            config: {
                              mapping: { packageName: 'hospital', key: 'DashboardAppointments', property: 'pageLabel' },
                              styles: { utilityClasses: 'text-sm font-medium text-slate-600' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-pagination-actions',
                            type: 'container',
                            config: {
                              layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-2'] },
                              children: [
                                {
                                  id: 'hospital-dashboard-pagination-prev',
                                  type: 'button',
                                  condition: {
                                    expression: 'page > 0',
                                    mappings: {
                                      page: { packageName: 'hospital', key: 'DashboardAppointments', property: 'page' }
                                    }
                                  },
                                  config: {
                                    text: 'Previous',
                                    styles: { styleTemplate: 'hosp.button.secondary' },
                                    click: { actionId: 'dashboard-prev-page' }
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-pagination-next',
                                  type: 'button',
                                  condition: {
                                    expression: 'hasNext',
                                    mappings: {
                                      hasNext: { packageName: 'hospital', key: 'DashboardAppointments', property: 'hasNext' }
                                    }
                                  },
                                  config: {
                                    text: 'Next',
                                    styles: { styleTemplate: 'hosp.button.secondary' },
                                    click: { actionId: 'dashboard-next-page' }
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-pagination-next-disabled',
                                  type: 'button',
                                  condition: {
                                    expression: '!hasNext',
                                    mappings: {
                                      hasNext: { packageName: 'hospital', key: 'DashboardAppointments', property: 'hasNext' }
                                    }
                                  },
                                  config: {
                                    text: 'Next',
                                    disabled: true,
                                    styles: { styleTemplate: 'hosp.popup.button.disabled' }
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
                      id: 'hospital-dashboard-panel-admin',
                      type: 'container',
                      condition: {
                        expression:
                          "String(role ?? '').toUpperCase() === 'ADMIN' && String(activeItem ?? '') === 'admin'",
                        mappings: {
                          role: { packageName: 'hospital', key: 'AuthSession', property: 'role' },
                          activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
                        }
                      },
                      config: {
                        styles: { utilityClasses: 'space-y-6' },
                        children: [
                          {
                            id: 'hospital-dashboard-admin-title-row',
                            type: 'container',
                            config: {
                              layout: { type: 'flex', flex: ['flex', 'flex-wrap', 'items-center', 'justify-between', 'gap-3'] },
                              children: [
                                {
                                  id: 'hospital-dashboard-admin-title',
                                  type: 'text',
                                  config: {
                                    text: 'Administration',
                                    styles: { styleTemplate: 'hosp.section.heading', utilityClasses: 'text-2xl' }
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-admin-refresh',
                                  type: 'button',
                                  config: {
                                    text: '🔄',
                                    title: 'Refresh',
                                    styles: {
                                      utilityClasses:
                                        'rounded-md border border-slate-300 px-2.5 py-1.5 text-base leading-none text-slate-700 hover:bg-slate-50'
                                    },
                                    click: {
                                      actionId: 'require-hospital-dashboard-session',
                                      data: { tab: 'admin' },
                                      onSuccess: { actionId: 'init-admin-dashboard' }
                                    }
                                  }
                                }
                              ]
                            }
                          },
                          {
                            id: 'hospital-dashboard-admin-error',
                            type: 'text',
                            condition: {
                              expression: 'String(adminErr ?? "").trim().length > 0',
                              mappings: {
                                adminErr: { packageName: 'hospital', key: 'AdminDashboard', property: 'error' }
                              }
                            },
                            config: {
                              mapping: { packageName: 'hospital', key: 'AdminDashboard', property: 'error' },
                              styles: { utilityClasses: 'text-sm font-medium text-red-600' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-admin-pending-heading',
                            type: 'text',
                            config: {
                              text: 'Pending registrations (doctor or admin)',
                              styles: { styleTemplate: 'hosp.section.subheading' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-admin-pending-empty',
                            type: 'text',
                            condition: {
                              expression: '!loading && (!pendingRequests || pendingRequests.length === 0)',
                              mappings: {
                                loading: { packageName: 'hospital', key: 'AdminDashboard', property: 'loading' },
                                pendingRequests: {
                                  packageName: 'hospital',
                                  key: 'AdminDashboard',
                                  property: 'pendingRequests'
                                }
                              }
                            },
                            config: {
                              text: 'No pending requests.',
                              styles: { utilityClasses: 'text-sm text-slate-500' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-admin-pending-list',
                            type: 'list',
                            condition: {
                              expression: '!loading && pendingRequests && pendingRequests.length > 0',
                              mappings: {
                                loading: { packageName: 'hospital', key: 'AdminDashboard', property: 'loading' },
                                pendingRequests: {
                                  packageName: 'hospital',
                                  key: 'AdminDashboard',
                                  property: 'pendingRequests'
                                }
                              }
                            },
                            config: {
                              listStyleTemplate: 'hosp.section.stack',
                              mapping: { packageName: 'hospital', key: 'AdminDashboard', property: 'pendingRequests' },
                              itemTemplate: {
                                layout: { type: 'flex', flex: ['flex', 'items-center', 'justify-between', 'gap-2', 'flex-wrap'] },
                                styles: { utilityClasses: 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2' },
                                children: [
                                  {
                                    id: 'hospital-dashboard-admin-pending-line',
                                    type: 'text',
                                    config: {
                                      text: '{{email}} · {{requestedRole}} · {{name}}',
                                      styles: { utilityClasses: 'text-sm text-slate-800' }
                                    }
                                  },
                                  {
                                    id: 'hospital-dashboard-admin-pending-approve',
                                    type: 'button',
                                    config: {
                                      text: '✅',
                                      title: 'Approve',
                                      styles: {
                                        utilityClasses:
                                          'rounded-md border border-emerald-600 px-2.5 py-1.5 text-base leading-none text-emerald-800 hover:bg-emerald-50'
                                      },
                                      click: {
                                        actionId: 'approve-admin-role-request',
                                        data: { userId: '{{userId}}' }
                                      }
                                    }
                                  }
                                ]
                              }
                            }
                          },
                          {
                            id: 'hospital-dashboard-admin-doctors-heading',
                            type: 'text',
                            config: {
                              text: 'Doctors',
                              styles: { styleTemplate: 'hosp.section.subheading' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-admin-doctors-list',
                            type: 'list',
                            condition: {
                              expression: '!loading && doctors && doctors.length > 0',
                              mappings: {
                                loading: { packageName: 'hospital', key: 'AdminDashboard', property: 'loading' },
                                doctors: { packageName: 'hospital', key: 'AdminDashboard', property: 'doctors' }
                              }
                            },
                            config: {
                              listStyleTemplate: 'hosp.section.stack',
                              mapping: { packageName: 'hospital', key: 'AdminDashboard', property: 'doctors' },
                              itemTemplate: {
                                layout: { type: 'flex', flex: ['flex', 'items-center', 'justify-between', 'gap-2', 'flex-wrap'] },
                                styles: { utilityClasses: 'rounded-lg border border-slate-200 bg-white px-3 py-2' },
                                children: [
                                  {
                                    id: 'hospital-dashboard-admin-doctor-line',
                                    type: 'text',
                                    config: {
                                      text: '{{name}} · {{email}} · {{department}} · {{roleStatus}} · Active: {{active}}',
                                      styles: { utilityClasses: 'text-sm text-slate-800' }
                                    }
                                  },
                                  {
                                    id: 'hospital-dashboard-admin-doctor-deactivate',
                                    type: 'button',
                                    condition: {
                                      expression: 'active === true || active === "true" || active === "Y"'
                                    },
                                    config: {
                                      text: '🚫',
                                      title: 'Deactivate',
                                      styles: {
                                        utilityClasses:
                                          'rounded-md border border-rose-400 px-2.5 py-1.5 text-base leading-none text-rose-700 hover:bg-rose-50'
                                      },
                                      click: {
                                        actionId: 'deactivate-admin-doctor',
                                        data: { userId: '{{id}}' }
                                      }
                                    }
                                  }
                                ]
                              }
                            }
                          },
                          {
                            id: 'hospital-dashboard-admin-register-heading',
                            type: 'text',
                            config: {
                              text: 'Register a new doctor',
                              styles: { styleTemplate: 'hosp.section.subheading' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-admin-register-grid',
                            type: 'container',
                            config: {
                              layout: { type: 'grid', grid: ['grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-3'] },
                              children: [
                                {
                                  id: 'hospital-dashboard-admin-reg-email',
                                  type: 'input',
                                  config: {
                                    label: 'Email',
                                    styles: { styleTemplate: 'hosp.form.input' },
                                    mapping: { packageName: 'hospital', key: 'AdminDoctorRegisterForm', property: 'emailId' }
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-admin-reg-password',
                                  type: 'input',
                                  config: {
                                    label: 'Password',
                                    inputType: 'password',
                                    styles: { styleTemplate: 'hosp.form.input' },
                                    mapping: { packageName: 'hospital', key: 'AdminDoctorRegisterForm', property: 'password' },
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-admin-reg-first',
                                  type: 'input',
                                  config: {
                                    label: 'First name',
                                    styles: { styleTemplate: 'hosp.form.input' },
                                    mapping: { packageName: 'hospital', key: 'AdminDoctorRegisterForm', property: 'firstName' },
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-admin-reg-last',
                                  type: 'input',
                                  config: {
                                    label: 'Last name',
                                    styles: { styleTemplate: 'hosp.form.input' },
                                    mapping: { packageName: 'hospital', key: 'AdminDoctorRegisterForm', property: 'lastName' },
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-admin-reg-address',
                                  type: 'input',
                                  config: {
                                    label: 'Address',
                                    styles: { styleTemplate: 'hosp.form.input' },
                                    mapping: { packageName: 'hospital', key: 'AdminDoctorRegisterForm', property: 'address' },
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-admin-reg-gender',
                                  type: 'input',
                                  config: {
                                    label: 'Gender',
                                    styles: { styleTemplate: 'hosp.form.input' },
                                    mapping: { packageName: 'hospital', key: 'AdminDoctorRegisterForm', property: 'gender' },
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-admin-reg-mobile',
                                  type: 'input',
                                  config: {
                                    label: 'Mobile',
                                    styles: { styleTemplate: 'hosp.form.input' },
                                    mapping: { packageName: 'hospital', key: 'AdminDoctorRegisterForm', property: 'mobileNumber' },
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-admin-reg-dept',
                                  type: 'input',
                                  config: {
                                    label: 'Department',
                                    styles: { styleTemplate: 'hosp.form.input' },
                                    mapping: { packageName: 'hospital', key: 'AdminDoctorRegisterForm', property: 'department' },
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-admin-reg-qual',
                                  type: 'input',
                                  config: {
                                    label: 'Qualifications',
                                    styles: { styleTemplate: 'hosp.form.input' },
                                    mapping: {
                                      packageName: 'hospital',
                                      key: 'AdminDoctorRegisterForm',
                                      property: 'qualifications'
                                    },
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-admin-reg-smc',
                                  type: 'input',
                                  config: {
                                    label: 'State Medical Council',
                                    styles: { styleTemplate: 'hosp.form.input' },
                                    mapping: { packageName: 'hospital', key: 'AdminDoctorRegisterForm', property: 'smcName' },
                                  }
                                },
                                {
                                  id: 'hospital-dashboard-admin-reg-regno',
                                  type: 'input',
                                  config: {
                                    label: 'SMC registration #',
                                    styles: { styleTemplate: 'hosp.form.input' },
                                    mapping: {
                                      packageName: 'hospital',
                                      key: 'AdminDoctorRegisterForm',
                                      property: 'smcRegistrationNumber'
                                    },
                                  }
                                }
                              ]
                            }
                          },
                          {
                            id: 'hospital-dashboard-admin-register-submit',
                            type: 'button',
                            config: {
                              text: '➕',
                              title: 'Create doctor account',
                              styles: {
                                utilityClasses:
                                  'rounded-md border border-emerald-600 px-2.5 py-1.5 text-base leading-none text-emerald-800 hover:bg-emerald-50'
                              },
                              click: { actionId: 'submit-admin-register-doctor' }
                            }
                          }
                        ]
                      }
                    },
                    {
                      id: 'hospital-dashboard-panel-working-slots',
                      type: 'container',
                      condition: {
                        expression:
                          "(String(role ?? '').toUpperCase() === 'ADMIN' || String(role ?? '').toUpperCase() === 'DOCTOR') && String(activeItem ?? '') === 'working-slots'",
                        mappings: {
                          role: { packageName: 'hospital', key: 'AuthSession', property: 'role' },
                          activeItem: { packageName: 'hospital', key: 'DashboardNav', property: 'activeItem' }
                        }
                      },
                      config: {
                        styles: { utilityClasses: 'space-y-4' },
                        children: [
                          {
                            id: 'hospital-dashboard-schedule-toolbar',
                            type: 'container',
                            config: {
                              layout: {
                                type: 'flex',
                                flex: ['flex', 'flex-wrap', 'items-center', 'justify-between', 'gap-3', 'mb-2']
                              },
                              children: [
                                {
                                  id: 'hospital-dashboard-schedule-title',
                                  type: 'text',
                                  config: {
                                    text: 'Set working time slots',
                                    styles: { styleTemplate: 'hosp.section.heading', utilityClasses: 'text-2xl' }
                                  }
                                }
                              ]
                            }
                          },
                          {
                            id: 'hospital-dashboard-schedule-error',
                            type: 'text',
                            condition: {
                              expression: 'scheduleErr && String(scheduleErr).trim().length > 0',
                              mappings: {
                                scheduleErr: { packageName: 'hospital', key: 'DoctorScheduleUi', property: 'error' }
                              }
                            },
                            config: {
                              mapping: { packageName: 'hospital', key: 'DoctorScheduleUi', property: 'error' },
                              styles: { utilityClasses: 'text-sm font-medium text-red-600' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-schedule-admin-pick',
                            type: 'dropdown',
                            condition: {
                              expression: "String(role ?? '').toUpperCase() === 'ADMIN'",
                              mappings: {
                                role: { packageName: 'hospital', key: 'AuthSession', property: 'role' }
                              }
                            },
                            config: {
                              label: 'Doctor',
                              mapping: { packageName: 'hospital', key: 'DoctorScheduleAdminDoctors', property: 'list' },
                              valueMapping: { packageName: 'hospital', key: 'DoctorScheduleUi', property: 'selectedDoctorId' },
                              change: { actionId: 'set-working-slots-doctor' },
                              styles: { styleTemplate: 'hosp.form.input', utilityClasses: 'max-w-md' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-schedule-doctor-label',
                            type: 'text',
                            condition: {
                              expression: "String(role ?? '').toUpperCase() === 'DOCTOR'",
                              mappings: {
                                role: { packageName: 'hospital', key: 'AuthSession', property: 'role' }
                              }
                            },
                            config: {
                              mapping: { packageName: 'hospital', key: 'DoctorScheduleUi', property: 'doctorName' },
                              styles: { utilityClasses: 'text-sm font-semibold text-slate-800' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-schedule-loading',
                            type: 'text',
                            condition: {
                              expression: 'scheduleLoading',
                              mappings: {
                                scheduleLoading: { packageName: 'hospital', key: 'DoctorScheduleUi', property: 'loading' }
                              }
                            },
                            config: {
                              text: 'Loading…',
                              styles: { utilityClasses: 'text-sm text-slate-600' }
                            }
                          },
                          {
                            id: 'hospital-dashboard-schedule-editor',
                            type: 'doctor-schedule-editor',
                            condition: {
                              expression:
                                "String(role ?? '').toUpperCase() === 'ADMIN' || String(role ?? '').toUpperCase() === 'DOCTOR'",
                              mappings: {
                                role: { packageName: 'hospital', key: 'AuthSession', property: 'role' }
                              }
                            },
                            config: {}
                          }
                        ]
                      }
                    }
                  ]
                }
              },
              
            ]
          }
        },
        hospitalSiteFooter(
          'hospital-dashboard-footer',
          'Agastya Healthcare Dashboard | Manage appointments efficiently.'
        )
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'patient-dashboard',
    title: 'Patient Dashboard',
    initializeActions: [{ actionId: 'set-dashboard-header-active' }, { actionId: 'load-home-content' }],
    container: {
      layoutTemplate: 'hosp.page.root',
      children: [
        ...hospitalPublicChromeTop,
        {
          id: 'hospital-patient-dashboard-main',
          type: 'container',
          config: {
            styles: { utilityClasses: 'w-full flex-1 min-h-0 flex flex-col gap-6' },
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
        hospitalSiteFooter(
          'hospital-patient-dashboard-footer',
          'Agastya Healthcare | Your patient dashboard and care updates.'
        )
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'doctor-overview',
    title: 'Doctor Overview',
    initializeActions: [{ actionId: 'set-home-header-active' }, { actionId: 'load-home-content' }],
    container: {
      layoutTemplate: 'hosp.page.root',
      children: [
        ...hospitalPublicChromeTop,
        {
          id: 'hospital-doctor-overview-main',
          type: 'container',
          config: {
            styles: { utilityClasses: 'w-full flex-1 min-h-0 flex flex-col gap-6' },
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
        hospitalSiteFooter(
          'hospital-doctor-overview-footer',
          'Agastya Healthcare | Meet our care team and specialists.'
        )
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'doctor-education',
    title: 'Doctor Education',
    initializeActions: [{ actionId: 'set-education-header-active' }, { actionId: 'init-doctor-education' }],
    container: {
      layoutTemplate: 'hosp.page.root',
      children: [
        ...hospitalPublicChromeTop,
        {
          id: 'hospital-doctor-education-main',
          type: 'container',
          config: {
            styles: { utilityClasses: 'w-full flex-1 min-h-0 flex flex-col gap-6' },
            children: [
              {
                id: 'hospital-doctor-education-flashcards',
                type: 'doctor-education-flashcards',
                condition: {
                  expression: "String(role ?? '').toUpperCase() === 'DOCTOR'",
                  mappings: {
                    role: { packageName: 'hospital', key: 'AuthSession', property: 'role' }
                  }
                },
                config: {}
              },
              {
                id: 'hospital-doctor-education-access-denied',
                type: 'container',
                condition: {
                  expression: "String(role ?? '').toUpperCase() !== 'DOCTOR'",
                  mappings: {
                    role: { packageName: 'hospital', key: 'AuthSession', property: 'role' }
                  }
                },
                config: {
                  styles: { styleTemplate: 'hosp.section.card' },
                  children: [
                    {
                      id: 'hospital-doctor-education-access-denied-text',
                      type: 'text',
                      config: {
                        text: 'Education is available for doctor users only.',
                        styles: { utilityClasses: 'text-sm font-medium text-slate-700' }
                      }
                    }
                  ]
                }
              }
            ]
          }
        },
        hospitalSiteFooter(
          'hospital-doctor-education-footer',
          'Agastya Healthcare | Clinical flashcards for continuous medical learning.'
        )
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'blog',
    title: 'Wellness Blog',
    initializeActions: [{ actionId: 'set-blog-header-active' }, { actionId: 'load-blog-previews' }],
    container: {
      layoutTemplate: 'hosp.page.root',
      children: [
        ...hospitalPublicChromeTop,
        {
          id: 'hospital-blog-main',
          type: 'container',
          config: {
            styles: { utilityClasses: 'w-full flex-1 min-h-0 flex flex-col gap-6 px-4 py-6 max-w-6xl mx-auto' },
            children: [
              {
                id: 'hospital-blog-heading',
                type: 'text',
                config: {
                  text: 'Wellness & curiosity',
                  styles: { styleTemplate: 'hosp.section.heading', utilityClasses: 'text-3xl' }
                }
              },
              {
                id: 'hospital-blog-sub',
                type: 'text',
                config: {
                  text: 'Short reads to spark questions and better habits — not medical advice. For personal decisions, speak with your clinician.',
                  styles: { utilityClasses: 'text-sm text-slate-600 max-w-3xl' }
                }
              },
              {
                id: 'hospital-blog-source',
                type: 'text',
                condition: {
                  expression:
                    '!loading && posts && posts.length > 0 && detail && String(detail ?? "").trim().length > 0',
                  mappings: {
                    loading: { packageName: 'hospital', key: 'BlogPreviews', property: 'loading' },
                    posts: { packageName: 'hospital', key: 'BlogPreviews', property: 'posts' },
                    detail: { packageName: 'hospital', key: 'BlogPreviews', property: 'contentSourceDetail' }
                  }
                },
                config: {
                  mapping: { packageName: 'hospital', key: 'BlogPreviews', property: 'contentSourceDetail' },
                  styles: {
                    utilityClasses: 'text-xs text-slate-500 max-w-3xl border-l-2 border-emerald-200 pl-3 py-1'
                  }
                }
              },
              {
                id: 'hospital-blog-loading',
                type: 'text',
                condition: {
                  expression: 'loading === true',
                  mappings: {
                    loading: { packageName: 'hospital', key: 'BlogPreviews', property: 'loading' }
                  }
                },
                config: {
                  text: 'Loading articles…',
                  styles: { utilityClasses: 'text-sm text-slate-500' }
                }
              },
              {
                id: 'hospital-blog-error',
                type: 'text',
                condition: {
                  expression: 'String(err ?? "").trim().length > 0',
                  mappings: {
                    err: { packageName: 'hospital', key: 'BlogPreviews', property: 'error' }
                  }
                },
                config: {
                  mapping: { packageName: 'hospital', key: 'BlogPreviews', property: 'error' },
                  styles: { utilityClasses: 'text-sm font-medium text-red-600' }
                }
              },
              {
                id: 'hospital-blog-list',
                type: 'list',
                condition: {
                  expression: '!loading && posts && posts.length > 0',
                  mappings: {
                    loading: { packageName: 'hospital', key: 'BlogPreviews', property: 'loading' },
                    posts: { packageName: 'hospital', key: 'BlogPreviews', property: 'posts' }
                  }
                },
                config: {
                  listStyleTemplate: 'hosp.blog.previewGrid',
                  mapping: { packageName: 'hospital', key: 'BlogPreviews', property: 'posts' },
                  itemTemplate: {
                    layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-2', 'h-full'] },
                    styles: {
                      utilityClasses:
                        'rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-200 transition-colors h-full'
                    },
                    children: [
                      {
                        id: 'hospital-blog-card-title',
                        type: 'text',
                        config: {
                          text: '{{title}}',
                          styles: { utilityClasses: 'text-lg font-semibold text-slate-900' }
                        }
                      },
                      {
                        id: 'hospital-blog-card-meta',
                        type: 'text',
                        config: {
                          text: '{{category}} · {{readTimeMinutes}} min read',
                          styles: { utilityClasses: 'text-xs font-medium uppercase tracking-wide text-emerald-700' }
                        }
                      },
                      {
                        id: 'hospital-blog-card-hook',
                        type: 'text',
                        config: {
                          text: '{{hook}}',
                          styles: { utilityClasses: 'text-sm font-medium text-slate-800 leading-snug flex-1' }
                        }
                      },
                      {
                        id: 'hospital-blog-card-questions',
                        type: 'text',
                        config: {
                          text: '{{curiosityQuestionsText}}',
                          styles: { utilityClasses: 'text-sm text-slate-600 leading-relaxed whitespace-pre-line' }
                        }
                      },
                      {
                        id: 'hospital-blog-card-read-more-hint',
                        type: 'text',
                        config: {
                          text: 'Open the article page for the full story, examples, and practical context.',
                          styles: { utilityClasses: 'text-xs text-slate-500 italic' }
                        }
                      },
                      {
                        id: 'hospital-blog-card-actions',
                        type: 'container',
                        config: {
                          layout: {
                            type: 'flex',
                            flex: ['flex', 'flex-row', 'flex-wrap', 'gap-3', 'items-center', 'mt-auto', 'pt-3']
                          },
                          children: [
                            {
                              id: 'hospital-blog-card-open-page',
                              type: 'button',
                              config: {
                                text: 'Open article page',
                                styles: {
                                  utilityClasses:
                                    'inline-flex text-sm font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-2'
                                },
                                click: {
                                  packageName: 'hospital',
                                  actionId: 'navigate-blog-article',
                                  data: { slug: '{{slug}}' }
                                }
                              }
                            }
                          ]
                        }
                      }
                    ]
                  }
                }
              },
              {
                id: 'hospital-blog-empty',
                type: 'text',
                condition: {
                  expression: '!loading && (!posts || posts.length === 0) && String(err ?? "").trim().length === 0',
                  mappings: {
                    loading: { packageName: 'hospital', key: 'BlogPreviews', property: 'loading' },
                    posts: { packageName: 'hospital', key: 'BlogPreviews', property: 'posts' },
                    err: { packageName: 'hospital', key: 'BlogPreviews', property: 'error' }
                  }
                },
                config: {
                  text: 'No articles to show yet.',
                  styles: { utilityClasses: 'text-sm text-slate-500' }
                }
              }
            ]
          }
        },
        hospitalSiteFooter('hospital-blog-footer', 'Agastya Healthcare | Wellness stories for curious readers.')
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'blog-article',
    title: 'Article',
    initializeActions: [{ actionId: 'set-blog-header-active' }, { actionId: 'load-blog-article-preview' }],
    container: {
      layoutTemplate: 'hosp.page.root',
      children: [
        ...hospitalPublicChromeTop,
        {
          id: 'hospital-blog-article-main',
          type: 'container',
          config: {
            styles: { utilityClasses: 'w-full flex-1 min-h-0 flex flex-col gap-6 px-4 py-6 max-w-3xl mx-auto' },
            children: [
              {
                id: 'hospital-blog-article-back',
                type: 'button',
                config: {
                  text: '← All articles',
                  styles: { utilityClasses: 'self-start text-sm font-semibold text-emerald-700 hover:text-emerald-800' },
                  click: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'blog' } }
                }
              },
              {
                id: 'hospital-blog-article-loading',
                type: 'text',
                condition: {
                  expression: 'loading === true',
                  mappings: {
                    loading: { packageName: 'hospital', key: 'BlogArticleView', property: 'loading' }
                  }
                },
                config: {
                  text: 'Loading article…',
                  styles: { utilityClasses: 'text-sm text-slate-500' }
                }
              },
              {
                id: 'hospital-blog-article-error',
                type: 'text',
                condition: {
                  expression: 'String(err ?? "").trim().length > 0',
                  mappings: {
                    err: { packageName: 'hospital', key: 'BlogArticleView', property: 'error' }
                  }
                },
                config: {
                  mapping: { packageName: 'hospital', key: 'BlogArticleView', property: 'error' },
                  styles: { utilityClasses: 'text-sm font-medium text-red-600' }
                }
              },
              {
                id: 'hospital-blog-article-title',
                type: 'text',
                condition: {
                  expression:
                    '!loading && String(err ?? "").trim().length === 0 && String(title ?? "").trim().length > 0',
                  mappings: {
                    loading: { packageName: 'hospital', key: 'BlogArticleView', property: 'loading' },
                    err: { packageName: 'hospital', key: 'BlogArticleView', property: 'error' },
                    title: { packageName: 'hospital', key: 'BlogArticleView', property: 'title' }
                  }
                },
                config: {
                  mapping: { packageName: 'hospital', key: 'BlogArticleView', property: 'title' },
                  styles: { styleTemplate: 'hosp.section.heading', utilityClasses: 'text-3xl' }
                }
              },
              {
                id: 'hospital-blog-article-meta',
                type: 'text',
                condition: {
                  expression:
                    '!loading && String(err ?? "").trim().length === 0 && String(metaLine ?? "").trim().length > 0',
                  mappings: {
                    loading: { packageName: 'hospital', key: 'BlogArticleView', property: 'loading' },
                    err: { packageName: 'hospital', key: 'BlogArticleView', property: 'error' },
                    metaLine: { packageName: 'hospital', key: 'BlogArticleView', property: 'metaLine' }
                  }
                },
                config: {
                  mapping: { packageName: 'hospital', key: 'BlogArticleView', property: 'metaLine' },
                  styles: { utilityClasses: 'text-xs font-medium uppercase tracking-wide text-emerald-700' }
                }
              },
              {
                id: 'hospital-blog-article-teaser',
                type: 'text',
                condition: {
                  expression:
                    '!loading && String(err ?? "").trim().length === 0 && String(teaser ?? "").trim().length > 0',
                  mappings: {
                    loading: { packageName: 'hospital', key: 'BlogArticleView', property: 'loading' },
                    err: { packageName: 'hospital', key: 'BlogArticleView', property: 'error' },
                    teaser: { packageName: 'hospital', key: 'BlogArticleView', property: 'teaser' }
                  }
                },
                config: {
                  mapping: { packageName: 'hospital', key: 'BlogArticleView', property: 'teaser' },
                  styles: { utilityClasses: 'text-base text-slate-700 leading-relaxed' }
                }
              }
            ]
          }
        },
        hospitalSiteFooter(
          'hospital-blog-article-footer',
          'Agastya Healthcare | Wellness stories for curious readers.'
        )
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'blog-read-more-popup',
    title: 'Article preview',
    container: {
      layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-4'] },
      children: [
        {
          id: 'hospital-blog-readmore-header',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.popup.header',
            children: [
              {
                id: 'hospital-blog-readmore-title',
                type: 'text',
                config: { text: 'Article preview', styles: { styleTemplate: 'hosp.popup.header.title' } }
              },
              {
                id: 'hospital-blog-readmore-close',
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
          id: 'hospital-blog-readmore-article-title',
          type: 'text',
          config: {
            mapping: { packageName: 'hospital', key: 'BlogReadMore', property: 'title' },
            styles: { utilityClasses: 'text-lg font-semibold text-slate-900' }
          }
        },
        {
          id: 'hospital-blog-readmore-meta',
          type: 'text',
          config: {
            mapping: { packageName: 'hospital', key: 'BlogReadMore', property: 'metaLine' },
            styles: { utilityClasses: 'text-xs font-medium uppercase tracking-wide text-emerald-700' }
          }
        },
        {
          id: 'hospital-blog-readmore-teaser',
          type: 'text',
          config: {
            mapping: { packageName: 'hospital', key: 'BlogReadMore', property: 'teaser' },
            styles: { utilityClasses: 'text-sm text-slate-700 leading-relaxed' }
          }
        },
        {
          id: 'hospital-blog-readmore-slug',
          type: 'text',
          condition: {
            expression: 'line && String(line ?? "").trim().length > 0',
            mappings: {
              line: { packageName: 'hospital', key: 'BlogReadMore', property: 'slugLine' }
            }
          },
          config: {
            mapping: { packageName: 'hospital', key: 'BlogReadMore', property: 'slugLine' },
            styles: { utilityClasses: 'text-xs text-slate-500 font-mono' }
          }
        },
        {
          id: 'hospital-blog-readmore-note',
          type: 'text',
          config: {
            text:
              'Full long-form articles are not hosted here yet. Use this preview for general education only; talk to your clinician for personal care.',
            styles: { utilityClasses: 'text-xs text-slate-500 border-t border-slate-100 pt-3' }
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
                      config: { text: 'Email *', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
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
                      config: { text: 'Password *', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
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
                          onSuccess: {
                            actionType: 'closePopup',
                            onSuccess: {
                              actionId: 'execute-post-login-action'
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-login-popup-google-section',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'flex-col', 'items-center', 'gap-3', 'w-full'] },
                  children: [
                    {
                      id: 'hospital-login-popup-or-text',
                      type: 'text',
                      config: {
                        text: 'or',
                        styles: { styleTemplate: 'hosp.form.infoText', utilityClasses: 'text-center w-full' }
                      }
                    },
                    {
                      id: 'hospital-login-popup-google',
                      type: 'button',
                      config: {
                        iconPreset: 'google',
                        text: 'Sign In With Google',
                        title: 'Sign In With Google',
                        styles: {
                          styleTemplate: 'hosp.popup.button.secondary',
                          utilityClasses: 'w-full max-w-xs gap-3'
                        },
                        click: {
                          actionId: 'auth-login-google',
                          onSuccess: {
                            actionType: 'closePopup',
                            onSuccess: {
                              actionId: 'execute-post-login-action'
                            }
                          }
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
                  layout: { type: 'flex', flex: ['flex', 'justify-center', 'items-center', 'gap-4', 'flex-wrap'] },
                  children: [
                    {
                      id: 'hospital-login-popup-reset-password-link',
                      type: 'button',
                      config: {
                        text: 'Reset / Forgot Password',
                        styles: { styleTemplate: 'hosp.popup.linkButton' },
                        click: {
                          actionId: 'open-reset-password-popup'
                        }
                      }
                    },
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
                      config: { text: 'FirstName *', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
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
                      config: { text: 'EmailId *', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
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
                      config: { text: 'Password *', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
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
                      config: { text: 'Gender *', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
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
                      config: { text: 'Role *', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
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
                  styles: { utilityClasses: 'min-w-0' },
                  children: [
                    {
                      id: 'hospital-register-popup-department-label',
                      type: 'text',
                      config: { text: 'Department *', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
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
                id: 'hospital-register-popup-qualifications-row',
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
                  styles: { utilityClasses: 'min-w-0' },
                  children: [
                    {
                      id: 'hospital-register-popup-qualifications-label',
                      type: 'text',
                      config: { text: 'Qualifications *', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
                    },
                    {
                      id: 'hospital-register-popup-qualifications',
                      type: 'input',
                      config: {
                        placeholder: 'MBBS, MD, etc.',
                        styles: { styleTemplate: 'hosp.form.input' },
                        labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                        change: { actionId: 'set-register-qualifications' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-register-popup-smc-name-row',
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
                  styles: { utilityClasses: 'min-w-0' },
                  children: [
                    {
                      id: 'hospital-register-popup-smc-name-label',
                      type: 'text',
                      config: { text: 'State Medical Council *', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
                    },
                    {
                      id: 'hospital-register-popup-smc-name',
                      type: 'input',
                      config: {
                        placeholder: 'Enter state medical council',
                        styles: { styleTemplate: 'hosp.form.input' },
                        labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                        change: { actionId: 'set-register-smc-name' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-register-popup-smc-registration-number-row',
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
                  styles: { utilityClasses: 'min-w-0' },
                  children: [
                    {
                      id: 'hospital-register-popup-smc-registration-number-label',
                      type: 'text',
                      config: { text: 'SMC registration number *', styles: { styleTemplate: 'hosp.form.inlineLabel' } }
                    },
                    {
                      id: 'hospital-register-popup-smc-registration-number',
                      type: 'input',
                      config: {
                        placeholder: 'Enter SMC registration number',
                        styles: { styleTemplate: 'hosp.form.input' },
                        labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                        change: { actionId: 'set-register-smc-registration-number' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-register-popup-terms-row',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'flex-wrap', 'items-center', 'gap-2'] },
                  styles: { utilityClasses: 'md:col-span-2' },
                  children: [
                    {
                      id: 'hospital-register-popup-accept-terms',
                      type: 'checkbox',
                      config: {
                        mapping: { packageName: 'hospital', key: 'RegisterForm', property: 'acceptTerms' },
                        label: '',
                        change: { actionId: 'set-register-accept-terms' }
                      }
                    },
                    {
                      id: 'hospital-register-popup-terms-lead',
                      type: 'text',
                      config: {
                        text: 'I have read and agree to the',
                        styles: { utilityClasses: 'text-sm text-slate-700' }
                      }
                    },
                    {
                      id: 'hospital-register-popup-terms-link',
                      type: 'button',
                      config: {
                        text: 'Terms & Conditions',
                        styles: { styleTemplate: 'hosp.popup.linkButton' },
                        click: { actionId: 'open-hospital-terms-new-tab' }
                      }
                    },
                    {
                      id: 'hospital-register-popup-terms-mid',
                      type: 'text',
                      config: {
                        text: 'and',
                        styles: { utilityClasses: 'text-sm text-slate-700' }
                      }
                    },
                    {
                      id: 'hospital-register-popup-privacy-link',
                      type: 'button',
                      config: {
                        text: 'Privacy Notice (India)',
                        styles: { styleTemplate: 'hosp.popup.linkButton' },
                        click: {
                          actionType: 'navigate',
                          navigate: { packageName: 'hospital', pageId: 'privacy' }
                        }
                      }
                    },
                    {
                      id: 'hospital-register-popup-terms-trail',
                      type: 'text',
                      config: {
                        text: '.',
                        styles: { utilityClasses: 'text-sm text-slate-700' }
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
                disabledCondition: {
                  expression:
                    "String(firstName ?? '').trim().length === 0 || String(lastName ?? '').trim().length === 0 || String(emailId ?? '').trim().length === 0 || String(password ?? '').trim().length === 0 || String(gender ?? '').trim().length === 0 || String(mobileNumber ?? '').trim().length === 0 || (String(role ?? '').toUpperCase() === 'DOCTOR' && (String(department ?? '').trim().length === 0 || String(qualifications ?? '').trim().length === 0 || String(smcName ?? '').trim().length === 0 || String(smcRegistrationNumber ?? '').trim().length === 0)) || acceptTerms !== true",
                  mappings: {
                    firstName: {
                      packageName: 'hospital',
                      key: 'RegisterForm',
                      property: 'firstName'
                    },
                    lastName: {
                      packageName: 'hospital',
                      key: 'RegisterForm',
                      property: 'lastName'
                    },
                    emailId: {
                      packageName: 'hospital',
                      key: 'RegisterForm',
                      property: 'emailId'
                    },
                    password: {
                      packageName: 'hospital',
                      key: 'RegisterForm',
                      property: 'password'
                    },
                    address: {
                      packageName: 'hospital',
                      key: 'RegisterForm',
                      property: 'address'
                    },
                    gender: {
                      packageName: 'hospital',
                      key: 'RegisterForm',
                      property: 'gender'
                    },
                    mobileNumber: {
                      packageName: 'hospital',
                      key: 'RegisterForm',
                      property: 'mobileNumber'
                    },
                    role: {
                      packageName: 'hospital',
                      key: 'RegisterForm',
                      property: 'role'
                    },
                    department: {
                      packageName: 'hospital',
                      key: 'RegisterForm',
                      property: 'department'
                    },
                    qualifications: {
                      packageName: 'hospital',
                      key: 'RegisterForm',
                      property: 'qualifications'
                    },
                    smcName: {
                      packageName: 'hospital',
                      key: 'RegisterForm',
                      property: 'smcName'
                    },
                    smcRegistrationNumber: {
                      packageName: 'hospital',
                      key: 'RegisterForm',
                      property: 'smcRegistrationNumber'
                    },
                    acceptTerms: {
                      packageName: 'hospital',
                      key: 'RegisterForm',
                      property: 'acceptTerms'
                    }
                  }
                },
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
                      },
                      qualifications: {
                        packageName: 'hospital',
                        key: 'RegisterForm',
                        property: 'qualifications',
                        hideNil: true
                      },
                      smcName: {
                        packageName: 'hospital',
                        key: 'RegisterForm',
                        property: 'smcName',
                        hideNil: true
                      },
                      smcRegistrationNumber: {
                        packageName: 'hospital',
                        key: 'RegisterForm',
                        property: 'smcRegistrationNumber',
                        hideNil: true
                      },
                      acceptTerms: {
                        packageName: 'hospital',
                        key: 'RegisterForm',
                        property: 'acceptTerms'
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
    pageId: 'reset-password-popup',
    title: 'Reset password',
    initializeActions: [{ actionId: 'init-password-reset-popup' }],
    container: {
      layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-4'] },
      children: [
        {
          id: 'hospital-reset-password-popup-header',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.popup.header',
            children: [
              {
                id: 'hospital-reset-password-popup-title',
                type: 'text',
                config: {
                  text: 'Reset password',
                  styles: { styleTemplate: 'hosp.popup.header.title' }
                }
              },
              {
                id: 'hospital-reset-password-popup-close',
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
          id: 'hospital-reset-password-popup-form',
          type: 'container',
          config: {
            layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-4'] },
            styles: { utilityClasses: 'w-full max-w-md mx-auto' },
            children: [
              {
                id: 'hospital-reset-password-popup-email-row',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-6'] },
                  children: [
                    {
                      id: 'hospital-reset-password-popup-email-label',
                      type: 'text',
                      config: {
                        text: 'Email *',
                        styles: { styleTemplate: 'hosp.form.inlineLabel', utilityClasses: 'w-44 md:w-48' }
                      }
                    },
                    {
                      id: 'hospital-reset-password-popup-email',
                      type: 'input',
                      config: {
                        mapping: { packageName: 'hospital', key: 'PasswordResetForm', property: 'emailId' },
                        placeholder: 'youremail@example.com',
                        styles: { styleTemplate: 'hosp.form.input' },
                        labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                        change: { actionId: 'set-password-reset-email-id' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-reset-password-popup-old-row',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-6'] },
                  children: [
                    {
                      id: 'hospital-reset-password-popup-old-label',
                      type: 'text',
                      config: {
                        text: 'Current password *',
                        styles: { styleTemplate: 'hosp.form.inlineLabel', utilityClasses: 'w-44 md:w-48' }
                      }
                    },
                    {
                      id: 'hospital-reset-password-popup-old',
                      type: 'input',
                      config: {
                        mapping: { packageName: 'hospital', key: 'PasswordResetForm', property: 'oldPassword' },
                        inputType: 'password',
                        placeholder: 'Current password',
                        styles: { styleTemplate: 'hosp.form.input' },
                        labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                        change: { actionId: 'set-password-reset-old-password' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-reset-password-popup-new-row',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-6'] },
                  children: [
                    {
                      id: 'hospital-reset-password-popup-new-label',
                      type: 'text',
                      config: {
                        text: 'New password *',
                        styles: { styleTemplate: 'hosp.form.inlineLabel', utilityClasses: 'w-44 md:w-48' }
                      }
                    },
                    {
                      id: 'hospital-reset-password-popup-new',
                      type: 'input',
                      config: {
                        mapping: { packageName: 'hospital', key: 'PasswordResetForm', property: 'newPassword' },
                        inputType: 'password',
                        placeholder: 'At least 8 characters',
                        styles: { styleTemplate: 'hosp.form.input' },
                        labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                        change: { actionId: 'set-password-reset-new-password' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-reset-password-popup-confirm-row',
                type: 'container',
                config: {
                  layout: { type: 'flex', flex: ['flex', 'items-center', 'gap-6'] },
                  children: [
                    {
                      id: 'hospital-reset-password-popup-confirm-label',
                      type: 'text',
                      config: {
                        text: 'Confirm new password *',
                        styles: { styleTemplate: 'hosp.form.inlineLabel', utilityClasses: 'w-44 md:w-48' }
                      }
                    },
                    {
                      id: 'hospital-reset-password-popup-confirm',
                      type: 'input',
                      config: {
                        mapping: { packageName: 'hospital', key: 'PasswordResetForm', property: 'confirmPassword' },
                        inputType: 'password',
                        placeholder: 'Re-enter new password',
                        styles: { styleTemplate: 'hosp.form.input' },
                        labelStyles: { styleTemplate: 'hosp.form.inlineField' },
                        change: { actionId: 'set-password-reset-confirm-password' }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-reset-password-popup-error',
                type: 'text',
                condition: {
                  expression: 'errorMessage && errorMessage.length > 0',
                  mappings: {
                    errorMessage: {
                      packageName: 'hospital',
                      key: 'PasswordResetForm',
                      property: 'errorMessage'
                    }
                  }
                },
                config: {
                  mapping: { packageName: 'hospital', key: 'PasswordResetForm', property: 'errorMessage' },
                  styles: { styleTemplate: 'hosp.form.errorText' }
                }
              }
            ]
          }
        },
        {
          id: 'hospital-reset-password-popup-actions',
          type: 'container',
          config: {
            layout: { type: 'flex', flex: ['flex', 'justify-center', 'items-center', 'gap-3'] },
            children: [
              {
                id: 'hospital-reset-password-popup-cancel',
                type: 'button',
                config: {
                  text: 'Cancel',
                  styles: { styleTemplate: 'hosp.popup.button.secondary' },
                  click: { actionType: 'closePopup' }
                }
              },
              {
                id: 'hospital-reset-password-popup-submit',
                type: 'button',
                disabledCondition: {
                  expression:
                    "Boolean(saving) || String(emailId ?? '').trim().length === 0 || String(oldPassword ?? '').trim().length === 0 || String(newPassword ?? '').trim().length < 8 || String(newPassword ?? '') !== String(confirmPassword ?? '')",
                  mappings: {
                    saving: {
                      packageName: 'hospital',
                      key: 'PasswordResetForm',
                      property: 'saving'
                    },
                    emailId: {
                      packageName: 'hospital',
                      key: 'PasswordResetForm',
                      property: 'emailId'
                    },
                    oldPassword: {
                      packageName: 'hospital',
                      key: 'PasswordResetForm',
                      property: 'oldPassword'
                    },
                    newPassword: {
                      packageName: 'hospital',
                      key: 'PasswordResetForm',
                      property: 'newPassword'
                    },
                    confirmPassword: {
                      packageName: 'hospital',
                      key: 'PasswordResetForm',
                      property: 'confirmPassword'
                    }
                  }
                },
                config: {
                  text: 'Update password',
                  styles: { styleTemplate: 'hosp.popup.button.primary' },
                  click: {
                    actionId: 'submit-password-reset',
                    mappings: {
                      emailId: {
                        packageName: 'hospital',
                        key: 'PasswordResetForm',
                        property: 'emailId',
                        hideNil: true
                      },
                      oldPassword: {
                        packageName: 'hospital',
                        key: 'PasswordResetForm',
                        property: 'oldPassword',
                        hideNil: true
                      },
                      newPassword: {
                        packageName: 'hospital',
                        key: 'PasswordResetForm',
                        property: 'newPassword',
                        hideNil: true
                      },
                      confirmPassword: {
                        packageName: 'hospital',
                        key: 'PasswordResetForm',
                        property: 'confirmPassword',
                        hideNil: true
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
                  mapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'patientName' },
                  change: { actionId: 'set-appointment-patient-field', data: { field: 'patientName' } },
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-email',
                type: 'input',
                config: {
                  label: 'Email Address *',
                  placeholder: 'youremail@example.com',
                  mapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'patientEmail' },
                  change: { actionId: 'set-appointment-patient-field', data: { field: 'patientEmail' } },
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-phone',
                type: 'input',
                config: {
                  label: 'Phone Number *',
                  placeholder: 'Phone Number',
                  mapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'patientPhone' },
                  change: { actionId: 'set-appointment-patient-field', data: { field: 'patientPhone' } },
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-age',
                type: 'input',
                config: {
                  label: 'Patient Age (years) *',
                  placeholder: 'Age in numbers, max 20',
                  inputType: 'text',
                  inputMode: 'numeric',
                  pattern: '[0-9]*',
                  numericOnly: true,
                  maxlength: 2,
                  mapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'ageGroup' },
                  change: { actionId: 'set-appointment-age', data: { maxAge: 20 } },
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
                  label: 'Doctor (select department first) *',
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
                id: 'hospital-popup-date-disabled',
                type: 'date-picker',
                condition: {
                  expression: "!department || String(department).trim().length === 0 || !doctor || String(doctor).trim().length === 0",
                  mappings: {
                    department: { packageName: 'hospital', key: 'AppointmentForm', property: 'department' },
                    doctor: { packageName: 'hospital', key: 'AppointmentForm', property: 'doctor' }
                  }
                },
                config: {
                  label: 'Preferred Date *',
                  disabled: true,
                  min: todayDateInputValue,
                  unavailableDatesMapping: {
                    packageName: 'hospital',
                    key: 'AppointmentDateAvailability',
                    property: 'unavailableDates'
                  },
                  slotCountsMapping: {
                    packageName: 'hospital',
                    key: 'AppointmentDateAvailability',
                    property: 'slotCounts'
                  },
                  change: { actionId: 'set-appointment-date' },
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-date',
                type: 'date-picker',
                condition: {
                  expression: "department && String(department).trim().length > 0 && doctor && String(doctor).trim().length > 0",
                  mappings: {
                    department: { packageName: 'hospital', key: 'AppointmentForm', property: 'department' },
                    doctor: { packageName: 'hospital', key: 'AppointmentForm', property: 'doctor' }
                  }
                },
                config: {
                  label: 'Preferred Date *',
                  min: todayDateInputValue,
                  unavailableDatesMapping: {
                    packageName: 'hospital',
                    key: 'AppointmentDateAvailability',
                    property: 'unavailableDates'
                  },
                  slotCountsMapping: {
                    packageName: 'hospital',
                    key: 'AppointmentDateAvailability',
                    property: 'slotCounts'
                  },
                  change: { actionId: 'set-appointment-date' },
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-time-slot-disabled',
                type: 'dropdown',
                condition: {
                  expression:
                    "!doctor || String(doctor).trim().length === 0 || !preferredDate || String(preferredDate).trim().length === 0",
                  mappings: {
                    doctor: { packageName: 'hospital', key: 'AppointmentForm', property: 'doctor' },
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
                  mapping: { packageName: 'hospital', key: 'AppointmentTimeSlots', property: 'list' },
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-time-slot',
                type: 'dropdown',
                condition: {
                  expression:
                    "doctor && String(doctor).trim().length > 0 && preferredDate && String(preferredDate).trim().length > 0",
                  mappings: {
                    doctor: { packageName: 'hospital', key: 'AppointmentForm', property: 'doctor' },
                    preferredDate: {
                      packageName: 'hospital',
                      key: 'AppointmentForm',
                      property: 'preferredDate'
                    }
                  }
                },
                config: {
                  label: 'Preferred Time Slot *',
                  mapping: { packageName: 'hospital', key: 'AppointmentTimeSlots', property: 'list' },
                  valueMapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'preferredTimeSlot' },
                  change: { actionId: 'set-appointment-time-slot' },
                  styles: { styleTemplate: 'hosp.form.input' }
                }
              },
              {
                id: 'hospital-popup-time-slot-empty-hint',
                type: 'text',
                condition: {
                  expression: 'slotAvailabilityMessage && String(slotAvailabilityMessage).trim().length > 0',
                  mappings: {
                    slotAvailabilityMessage: {
                      packageName: 'hospital',
                      key: 'AppointmentForm',
                      property: 'slotAvailabilityMessage'
                    }
                  }
                },
                config: {
                  mapping: { packageName: 'hospital', key: 'AppointmentForm', property: 'slotAvailabilityMessage' },
                  styles: {
                    utilityClasses: 'mt-1 block w-full text-left text-sm text-red-600 md:col-start-2'
                  }
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
                  label:
                    'Prior documents / scans (optional, up to 2 images)',
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
  },
  hospitalBookAppointmentPage,
  hospitalBookAppointmentPopupPage,
  hospitalEprescriptionPopupPage,
  hospitalProfilePage,
  hospitalTermsPage,
  hospitalPrivacyPage,
  {
    packageName: 'hospital',
    pageId: 'appointment-receipts-popup',
    title: 'Appointment Receipts',
    container: {
      layout: { type: 'flex', flex: ['flex', 'flex-col', 'gap-4'] },
      children: [
        {
          id: 'hospital-receipts-popup-header',
          type: 'container',
          config: {
            layoutTemplate: 'hosp.popup.header',
            children: [
              {
                id: 'hospital-receipts-popup-title',
                type: 'text',
                config: { text: 'Receipts', styles: { styleTemplate: 'hosp.popup.header.title' } }
              },
              {
                id: 'hospital-receipts-popup-close',
                type: 'button',
                config: {
                  text: 'X',
                  styles: { styleTemplate: 'hosp.popup.header.closeButton' },
                  click: { actionId: 'close-appointment-receipt-viewer' }
                }
              }
            ]
          }
        },
        {
          id: 'hospital-receipts-popup-scroll-shell',
          type: 'container',
          config: {
            styles: { utilityClasses: 'max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3' },
            children: [
              {
                id: 'hospital-receipts-popup-empty',
                type: 'text',
                condition: {
                  expression: '!items || items.length === 0',
                  mappings: {
                    items: { packageName: 'hospital', key: 'DashboardReceiptViewer', property: 'items' }
                  }
                },
                config: {
                  text: 'No receipts found for this appointment.',
                  styles: { utilityClasses: 'text-sm text-slate-600' }
                }
              },
              {
                id: 'hospital-receipts-popup-list',
                type: 'list',
                condition: {
                  expression: 'items && items.length > 0',
                  mappings: {
                    items: { packageName: 'hospital', key: 'DashboardReceiptViewer', property: 'items' }
                  }
                },
                config: {
                  listStyleTemplate: 'hosp.section.stack',
                  mapping: { packageName: 'hospital', key: 'DashboardReceiptViewer', property: 'items' },
                  itemTemplate: {
                    layoutTemplate: 'hosp.section.stack',
                    styles: { utilityClasses: 'rounded-lg border border-slate-200 bg-white p-3 mb-3' },
                    children: [
                      {
                        id: 'hospital-receipts-popup-item-file-name',
                        type: 'text',
                        config: {
                          text: '{{fileName}}',
                          styles: { utilityClasses: 'text-xs font-semibold text-slate-700 mb-2' }
                        }
                      },
                      {
                        id: 'hospital-receipts-popup-item-image',
                        type: 'image',
                        config: {
                          src: '{{src}}',
                          alt: '{{fileName}}',
                          styles: { utilityClasses: 'w-full rounded-md border border-slate-100 bg-white object-contain max-h-[42vh]' }
                        }
                      },
                      {
                        id: 'hospital-receipts-popup-item-actions',
                        type: 'container',
                        config: {
                          layout: { type: 'flex', flex: ['flex', 'items-center', 'justify-end', 'gap-2', 'mt-2'] },
                          children: [
                            {
                              id: 'hospital-receipts-popup-item-download',
                              type: 'button',
                              config: {
                                text: '{{downloadActionIcon}}',
                                title: 'Download',
                                styles: {
                                  utilityClasses:
                                    'rounded-md border border-emerald-500 px-2 py-1 text-xs leading-none text-emerald-700 hover:bg-emerald-50'
                                },
                                click: {
                                  actionId: 'download-appointment-receipt',
                                  data: { src: '{{src}}', fileName: '{{fileName}}' }
                                }
                              }
                            },
                            {
                              id: 'hospital-receipts-popup-item-delete',
                              type: 'button',
                              config: {
                                text: '{{deleteActionIcon}}',
                                hiddenWhenEmptyText: true,
                                title: 'Delete',
                                styles: {
                                  utilityClasses:
                                    'rounded-md border border-rose-400 px-2 py-1 text-xs leading-none text-rose-700 hover:bg-rose-50'
                                },
                                click: {
                                  actionId: 'delete-appointment-receipt-item',
                                  data: { receiptId: '{{id}}' }
                                }
                              }
                            }
                          ]
                        }
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
  }
  ,
  {
    packageName: 'hospital',
    pageId: 'chat',
    title: 'Chat',
    initializeActions: [{ actionId: 'set-home-header-active' }, { actionId: 'chat-connect' }],
    container: {
      layoutTemplate: 'hosp.page.root',
      children: [
        ...hospitalPublicChromeTop,
        {
          id: 'hospital-chat-main',
          type: 'container',
          config: {
            styles: { utilityClasses: 'w-full flex-1 min-h-0 flex flex-col px-4 sm:px-6 md:px-8 py-6' },
            children: [
              {
                id: 'hospital-chat-page-patient-quicklinks',
                type: 'container',
                condition: {
                  expression:
                    "userId && String(userId).trim().length > 0 && String(role ?? '').toUpperCase() !== 'ADMIN' && String(role ?? '').toUpperCase() !== 'DOCTOR'",
                  mappings: {
                    userId: { packageName: 'hospital', key: 'AuthSession', property: 'userId' },
                    role: { packageName: 'hospital', key: 'AuthSession', property: 'role' }
                  }
                },
                config: {
                  layout: {
                    type: 'flex',
                    flex: ['flex', 'flex-col', 'gap-2', 'sm:flex-row', 'sm:flex-wrap', 'w-full', 'max-w-2xl', 'mb-4']
                  },
                  children: [
                    {
                      id: 'hospital-chat-page-quick-appointment',
                      type: 'button',
                      config: {
                        text: 'Set An Appointment',
                        styles: {
                          utilityClasses:
                            'w-full sm:flex-1 min-w-0 rounded-lg border border-emerald-600 bg-white px-3 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50'
                        },
                        click: { actionId: 'open-appointment-popup' }
                      }
                    },
                    {
                      id: 'hospital-chat-page-quick-profile',
                      type: 'button',
                      config: {
                        text: 'User Profile',
                        styles: {
                          utilityClasses:
                            'w-full sm:flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50'
                        },
                        click: {
                          actionId: 'set-profile-header-active',
                          onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'profile' } }
                        }
                      }
                    }
                  ]
                }
              },
              {
                id: 'hospital-chat-root',
                type: 'chat',
                config: {
                  enableSmartAi: true,
                  setModeAction: { actionId: 'chat-set-mode' },
                  aiShowDisclaimerAction: { actionId: 'chat-ai-show-disclaimer-once' },
                  aiDismissDisclaimerAction: { actionId: 'chat-ai-dismiss-disclaimer' },
                  aiStartChatAction: { actionId: 'chat-ai-start' },
                  aiSendMessageAction: { actionId: 'chat-ai-send-message' },
                  startChatAction: { actionId: 'chat-start' },
                  acceptSupportRequestAction: { actionId: 'chat-support-accept' },
                  rejectSupportRequestAction: { actionId: 'chat-support-reject' },
                  sendMessageAction: { actionId: 'chat-send-message' },
                  supportUserId: 'support',
                  autoStart: false,
                  termsUrl: '/terms'
                }
              }
            ]
          }
        },
        hospitalSiteFooter(
          'hospital-chat-footer',
          'Agastya Healthcare | Questions? Our team is here to help.'
        )
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'chat-popup',
    title: 'Chat',
    initializeActions: [{ actionId: 'chat-connect' }],
    container: {
      layout: {
        type: 'flex',
        flex: ['flex', 'flex-col', 'h-full', 'min-h-0', 'min-w-0', 'max-w-full', 'max-h-full', 'overflow-hidden']
      },
      children: [
        {
          id: 'hospital-chat-popup-header',
          type: 'container',
          config: {
            layout: { type: 'flex', flex: ['flex', 'items-center', 'justify-between'] },
            styles: { utilityClasses: 'shrink-0 px-4 py-3 border-b border-slate-200 bg-white' },
            children: [
              {
                id: 'hospital-chat-popup-title',
                type: 'text',
                config: {
                  text: 'Health Assistant',
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
          id: 'hospital-chat-popup-patient-quicklinks',
          type: 'container',
          condition: {
            expression:
              "userId && String(userId).trim().length > 0 && String(role ?? '').toUpperCase() !== 'ADMIN' && String(role ?? '').toUpperCase() !== 'DOCTOR'",
            mappings: {
              userId: { packageName: 'hospital', key: 'AuthSession', property: 'userId' },
              role: { packageName: 'hospital', key: 'AuthSession', property: 'role' }
            }
          },
          config: {
            layout: {
              type: 'flex',
              flex: ['flex', 'flex-col', 'gap-2', 'sm:flex-row', 'sm:flex-wrap', 'shrink-0', 'px-4', 'py-2.5', 'border-b', 'border-slate-100', 'bg-slate-50']
            },
            children: [
              {
                id: 'hospital-chat-popup-quick-appointment',
                type: 'button',
                config: {
                  text: 'Set An Appointment',
                  styles: {
                    utilityClasses:
                      'w-full sm:flex-1 min-w-0 rounded-lg border border-emerald-600 bg-white px-3 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50'
                  },
                  click: { actionId: 'open-appointment-popup' }
                }
              },
              {
                id: 'hospital-chat-popup-quick-profile',
                type: 'button',
                config: {
                  text: 'User Profile',
                  styles: {
                    utilityClasses:
                      'w-full sm:flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50'
                  },
                  click: {
                    actionType: 'closePopup',
                    onSuccess: {
                      actionId: 'set-profile-header-active',
                      onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'profile' } }
                    }
                  }
                }
              }
            ]
          }
        },
        {
          id: 'hospital-chat-popup-body-shell',
          type: 'container',
          config: {
            styles: { utilityClasses: 'flex min-h-0 flex-1 flex-col overflow-hidden' },
            children: [
              {
                id: 'hospital-chat-popup-body',
                type: 'chat',
                config: {
                  enableSmartAi: true,
                  setModeAction: { actionId: 'chat-set-mode' },
                  aiShowDisclaimerAction: { actionId: 'chat-ai-show-disclaimer-once' },
                  aiDismissDisclaimerAction: { actionId: 'chat-ai-dismiss-disclaimer' },
                  aiStartChatAction: { actionId: 'chat-ai-start' },
                  aiSendMessageAction: { actionId: 'chat-ai-send-message' },
                  startChatAction: { actionId: 'chat-start' },
                  acceptSupportRequestAction: { actionId: 'chat-support-accept' },
                  rejectSupportRequestAction: { actionId: 'chat-support-reject' },
                  sendMessageAction: { actionId: 'chat-send-message' },
                  supportUserId: 'support',
                  autoStart: false,
                  embedded: true,
                  termsUrl: '/terms',
                  styles: { utilityClasses: 'w-full max-w-full min-w-0 h-full min-h-0' }
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
    pageId: 'doctor-working-slots',
    title: 'Set working time slots',
    initializeActions: [
      { actionId: 'set-dashboard-nav-working-slots' },
      { actionId: 'set-dashboard-header-active' },
      { actionId: 'init-doctor-working-slots' },
      { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'dashboard' } }
    ],
    container: {
      layoutTemplate: 'hosp.page.root',
      children: [
        {
          id: 'hospital-doctor-working-slots-redirect',
          type: 'container',
          config: {
            styles: { utilityClasses: 'sr-only' },
            children: []
          }
        }
      ]
    }
  },
  {
    packageName: 'hospital',
    pageId: 'video-call-popup',
    title: 'Video Call',
    initializeActions: [
      { actionId: 'call-connect' },
      { actionId: 'hospital-prepare-video-session' },
      { actionId: 'call-send-appointment-invite' }
    ],
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
                  click: { actionId: 'call-end' }
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
