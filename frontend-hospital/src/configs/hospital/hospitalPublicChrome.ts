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
                      src: 'https://res.cloudinary.com/dbke33vfd/image/upload/v1776158879/stetho_n1bp0a.jpg',
                      alt: 'Little Sprouts Care logo',
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
                      text: 'Little Sprouts Care',
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
              id: 'hospital-public-header-nav-profile-active',
              type: 'button',
              condition: {
                expression:
                  "userId && String(userId).trim().length > 0 && activeMenu === 'PROFILE'",
                mappings: {
                  userId: { packageName: 'hospital', key: 'AuthSession', property: 'userId' },
                  activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                }
              },
              config: {
                text: 'Profile',
                styles: {
                  styleTemplate: 'hosp.header.menuButton',
                  utilityClasses: 'bg-emerald-100 text-emerald-700'
                },
                click: {
                  actionId: 'set-profile-header-active',
                  onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'profile' } }
                }
              }
            },
            {
              id: 'hospital-public-header-nav-profile',
              type: 'button',
              condition: {
                expression:
                  "userId && String(userId).trim().length > 0 && activeMenu !== 'PROFILE'",
                mappings: {
                  userId: { packageName: 'hospital', key: 'AuthSession', property: 'userId' },
                  activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                }
              },
              config: {
                text: 'Profile',
                styles: { styleTemplate: 'hosp.header.menuButton' },
                click: {
                  actionId: 'set-profile-header-active',
                  onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'profile' } }
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
                text: 'Login',
                styles: { styleTemplate: 'hosp.header.authButton' },
                click: { actionId: 'open-login-popup' }
              }
            },
            {
              id: 'hospital-public-header-user-display',
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
                styles: { styleTemplate: 'hosp.header.userButton' },
                click: {
                  actionId: 'set-profile-header-active',
                  onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'profile' } }
                }
              }
            },
            {
              id: 'hospital-public-header-login-state',
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
              id: 'hospital-public-header-logout',
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
    expression: 'headerMenuOpen',
    mappings: {
      headerMenuOpen: { packageName: 'hospital', key: 'ResponsiveUiState', property: 'headerMenuOpen' }
    }
  },
  config: {
    styles: { utilityClasses: 'lg:hidden rounded-xl border border-slate-200 bg-white px-3 py-2' },
    children: [
      {
        id: 'hospital-public-mobile-menu-home',
        type: 'button',
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
        id: 'hospital-public-mobile-menu-dashboard',
        type: 'button',
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
        id: 'hospital-public-mobile-menu-profile',
        type: 'button',
        condition: {
          expression: "userId && String(userId).trim().length > 0",
          mappings: {
            userId: { packageName: 'hospital', key: 'AuthSession', property: 'userId' }
          }
        },
        config: {
          text: 'Profile',
          styles: { styleTemplate: 'hosp.header.menuButton' },
          click: {
            actionId: 'set-profile-header-active',
            onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'profile' } }
          }
        }
      },
      {
        id: 'hospital-public-mobile-menu-contact',
        type: 'button',
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
