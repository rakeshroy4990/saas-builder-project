import type { ComponentDefinition, ConditionConfig } from '../../core/types/ComponentDefinition';

/** Patient-facing booking; doctors use the dashboard instead. */
export const disabledWhenLoggedInAsDoctor: ConditionConfig = {
  expression: "String(role ?? '').toUpperCase() === 'DOCTOR'",
  mappings: {
    role: { packageName: 'hospital', key: 'AuthSession', property: 'role' }
  }
};

/** Shared site header + mobile menu (Home / Dashboard / Contact, auth, Book Now). */
const hospitalPublicHeader: ComponentDefinition = {
  id: 'hospital-public-header',
  type: 'container',
  config: {
    layoutTemplate: 'hosp.header.shell',
    styles: { styleTemplate: 'hosp.header.card' },
    children: [
      {
        id: 'hospital-public-header-lead',
        type: 'container',
        config: {
          layoutTemplate: 'hosp.header.lead',
          children: [
            {
              id: 'hospital-public-header-mobile-menu-slot',
              type: 'container',
              config: {
                styles: { utilityClasses: 'w-10 shrink-0 flex items-center justify-center' },
                children: [
                  {
                    id: 'hospital-public-header-mobile-menu-toggle-left',
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
              id: 'hospital-public-header-brand',
              type: 'container',
              config: {
                layoutTemplate: 'hosp.header.brand',
                children: [
                  {
                    id: 'hospital-public-header-logo',
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
                    id: 'hospital-public-header-title',
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
        id: 'hospital-public-header-nav',
        type: 'container',
        config: {
          layoutTemplate: 'hosp.header.nav',
          styles: { utilityClasses: 'hidden lg:flex items-center gap-4' },
          children: [
            {
              id: 'hospital-public-header-nav-home-active',
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
                click: {
                  actionId: 'set-home-header-active',
                  onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'home' } }
                }
              }
            },
            {
              id: 'hospital-public-header-nav-home',
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
              id: 'hospital-public-header-nav-dashboard-active',
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
              id: 'hospital-public-header-nav-dashboard',
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
                click: {
                  actionId: 'set-dashboard-header-active',
                  onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'dashboard' } }
                }
              }
            },
            {
              id: 'hospital-public-header-nav-education-active',
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
                styles: {
                  styleTemplate: 'hosp.header.menuButton',
                  utilityClasses: 'bg-emerald-100 text-emerald-700'
                },
                click: {
                  actionId: 'set-education-header-active',
                  onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'doctor-education' } }
                }
              }
            },
            {
              id: 'hospital-public-header-nav-education',
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
              id: 'hospital-public-header-nav-contact-active',
              type: 'button',
              condition: {
                expression: "activeMenu === 'CONTACT'",
                mappings: {
                  activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                }
              },
              config: {
                text: 'Contact',
                styles: {
                  styleTemplate: 'hosp.header.menuButton',
                  utilityClasses: 'bg-emerald-100 text-emerald-700'
                },
                click: { actionId: 'scroll-home-contact' }
              }
            },
            {
              id: 'hospital-public-header-nav-contact',
              type: 'button',
              condition: {
                expression: "activeMenu !== 'CONTACT'",
                mappings: {
                  activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                }
              },
              config: {
                text: 'Contact',
                styles: { styleTemplate: 'hosp.header.menuButton' },
                click: { actionId: 'scroll-home-contact' }
              }
            }
          ]
        }
      },
      {
        id: 'hospital-public-header-actions',
        type: 'container',
        config: {
          layoutTemplate: 'hosp.header.actions',
          children: [
            {
              id: 'hospital-public-header-login',
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
              id: 'hospital-public-header-user-anchor',
              type: 'container',
              condition: {
                expression: "userId && String(userId).trim().length > 0",
                mappings: {
                  userId: { packageName: 'hospital', key: 'AuthSession', property: 'userId' }
                }
              },
              config: {
                // lg hid the name on iPad/tablet (<1024px); md matches tablet portrait/landscape.
                styles: { utilityClasses: 'relative hidden md:block' },
                rootAttrs: { 'data-profile-menu-root': true },
                children: [
                  {
                    id: 'hospital-public-header-user-display',
                    type: 'button',
                    config: {
                      mapping: { packageName: 'hospital', key: 'AuthSession', property: 'userDisplayName' },
                      styles: { styleTemplate: 'hosp.header.userButton' },
                      click: { actionId: 'toggle-profile-header-menu' }
                    }
                  },
                  {
                    id: 'hospital-public-header-user-menu',
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
                          id: 'hospital-public-header-user-menu-profile',
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
                          id: 'hospital-public-header-user-menu-inactive',
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
                          id: 'hospital-public-header-user-menu-logout',
                          type: 'button',
                          config: {
                            text: 'Logout',
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
              id: 'hospital-public-header-user-anchor-mobile',
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
                    id: 'hospital-public-header-user-display-mobile',
                    type: 'button',
                    config: {
                      mapping: { packageName: 'hospital', key: 'AuthSession', property: 'userDisplayName' },
                      mappingMaxLength: 50,
                      textFallback: 'Account',
                      styles: {
                        styleTemplate: 'hosp.header.userMenuTriggerMobile',
                        utilityClasses: 'min-w-0 max-w-[18ch] sm:max-w-[22ch] truncate'
                      },
                      title: 'Open profile menu',
                      click: { actionId: 'toggle-profile-header-menu' }
                    }
                  },
                  {
                    id: 'hospital-public-header-user-menu-mobile',
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
                          id: 'hospital-public-header-user-menu-profile-mobile',
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
                          id: 'hospital-public-header-user-menu-inactive-mobile',
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
                          id: 'hospital-public-header-user-menu-logout-mobile',
                          type: 'button',
                          config: {
                            text: 'Logout',
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
              id: 'hospital-public-header-cta',
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
};

const hospitalPublicMobileMenu: ComponentDefinition = {
  id: 'hospital-public-mobile-menu-panel',
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
        id: 'hospital-public-mobile-menu-home-active',
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
        id: 'hospital-public-mobile-menu-home',
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
        id: 'hospital-public-mobile-menu-dashboard-active',
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
        id: 'hospital-public-mobile-menu-dashboard',
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
          click: {
            actionId: 'set-dashboard-header-active',
            onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'dashboard' } }
          }
        }
      },
      {
        id: 'hospital-public-mobile-menu-education-active',
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
        id: 'hospital-public-mobile-menu-education',
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
        id: 'hospital-public-mobile-menu-contact-active',
        type: 'button',
        condition: {
          expression: "activeMenu === 'CONTACT'",
          mappings: {
            activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
          }
        },
        config: {
          text: 'Contact',
          styles: { styleTemplate: 'hosp.header.menuButtonActive' },
          click: { actionId: 'scroll-home-contact' }
        }
      },
      {
        id: 'hospital-public-mobile-menu-contact',
        type: 'button',
        condition: {
          expression: "activeMenu !== 'CONTACT'",
          mappings: {
            activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
          }
        },
        config: {
          text: 'Contact',
          styles: { styleTemplate: 'hosp.header.menuButton' },
          click: { actionId: 'scroll-home-contact' }
        }
      }
    ]
  }
};

/** Use after `layoutTemplate: 'hosp.page.root'` — pair with a `flex-1` main column and `hospitalSiteFooter` for a pinned footer. */
export const hospitalPublicChromeTop: ComponentDefinition[] = [hospitalPublicHeader, hospitalPublicMobileMenu];

export type HospitalSiteFooterOptions = {
  /**
   * Target page for the footer legal link. Pass empty string to hide the Terms row
   * (e.g. on the Terms page itself).
   */
  termsPageId?: string;
};

export function hospitalSiteFooter(
  footerRootId: string,
  tagline: string,
  options?: HospitalSiteFooterOptions
): ComponentDefinition {
  const termsPageId = options?.termsPageId !== undefined ? options.termsPageId.trim() : 'terms';
  const showTermsLink = termsPageId.length > 0;

  const children: ComponentDefinition[] = [
    {
      id: `${footerRootId}-text`,
      type: 'text',
      config: {
        text: tagline,
        styles: { utilityClasses: 'text-xs text-slate-500 text-center' }
      }
    }
  ];

  if (showTermsLink) {
    children.push({
      id: `${footerRootId}-legal-row`,
      type: 'container',
      config: {
        layout: { type: 'flex', flex: ['flex', 'justify-center', 'items-center', 'pt-2'] },
        children: [
          {
            id: `${footerRootId}-terms-link`,
            type: 'button',
            config: {
              text: 'Terms & Conditions',
              styles: { styleTemplate: 'hosp.popup.linkButton' },
              click: {
                actionType: 'navigate',
                navigate: { packageName: 'hospital', pageId: termsPageId }
              }
            }
          }
        ]
      }
    });
  }

  return {
    id: footerRootId,
    type: 'container',
    config: {
      styles: {
        utilityClasses: 'mt-auto w-full shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3'
      },
      children
    }
  };
}
