import type { ComponentDefinition, ConditionConfig } from '../../core/types/ComponentDefinition';

/** Patient-facing booking; doctors use the dashboard instead. */
export const disabledWhenLoggedInAsDoctor: ConditionConfig = {
  expression: "String(role ?? '').toUpperCase() === 'DOCTOR'",
  mappings: {
    role: { packageName: 'hospital', key: 'AuthSession', property: 'role' }
  }
};

export const visibleWhenNotLoggedInAsDoctor: ConditionConfig = {
  expression: "String(role ?? '').toUpperCase() !== 'DOCTOR'",
  mappings: {
    role: { packageName: 'hospital', key: 'AuthSession', property: 'role' }
  }
};

/** Shared site header + mobile menu (Home / Dashboard / Blog, auth, Book Now). */
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
                      titleI18nKey: 'nav.menu',
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
                      altI18nKey: 'hospital.logoAlt',
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
                      i18nKey: 'hospital.brandTitle',
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
                i18nKey: 'nav.home',
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
                i18nKey: 'nav.home',
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
                i18nKey: 'nav.dashboard',
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
                i18nKey: 'nav.dashboard',
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
                i18nKey: 'nav.education',
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
                i18nKey: 'nav.education',
                styles: { styleTemplate: 'hosp.header.menuButton' },
                click: {
                  actionId: 'set-education-header-active',
                  onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'doctor-education' } }
                }
              }
            },
            {
              id: 'hospital-public-header-nav-blog-active',
              type: 'button',
              condition: {
                expression: "activeMenu === 'BLOG'",
                mappings: {
                  activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                }
              },
              config: {
                i18nKey: 'nav.blog',
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
              id: 'hospital-public-header-nav-blog',
              type: 'button',
              condition: {
                expression: "activeMenu !== 'BLOG'",
                mappings: {
                  activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
                }
              },
              config: {
                i18nKey: 'nav.blog',
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
        id: 'hospital-public-header-actions',
        type: 'container',
        config: {
          layoutTemplate: 'hosp.header.actions',
          children: [
            {
              id: 'hospital-public-header-actions-cluster',
              type: 'container',
              config: {
                styles: {
                  utilityClasses:
                    'flex min-w-0 w-auto shrink-0 flex-row flex-nowrap items-center gap-2 sm:gap-3'
                },
                children: [
                  {
                    id: 'hospital-public-header-language',
                    type: 'language-switcher',
                    config: {}
                  },
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
                      i18nKey: 'nav.loginRegister',
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
                            trailingVisual: 'chevron-down',
                            titleI18nKey: 'nav.accountMenuTitle',
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
                            layout: { type: 'flex', flex: ['flex', 'flex-col', 'items-stretch', 'gap-1'] },
                            styles: {
                              utilityClasses:
                                'absolute left-0 top-[calc(100%+6px)] z-30 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-md'
                            },
                            children: [
                              {
                                id: 'hospital-public-header-user-menu-profile',
                                type: 'button',
                                config: {
                                  i18nKey: 'nav.profile',
                                  styles: { styleTemplate: 'hosp.header.menuButton', utilityClasses: 'w-full justify-start text-left' },
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
                                  i18nKey: 'nav.inactiveAccount',
                                  styles: { styleTemplate: 'hosp.header.menuButton', utilityClasses: 'w-full justify-start text-left' },
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
                                  i18nKey: 'nav.signOut',
                                  pendingI18nKey: 'nav.signingOut',
                                  styles: { styleTemplate: 'hosp.header.menuButton', utilityClasses: 'w-full justify-start text-left' },
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
                            textFallbackI18nKey: 'nav.account',
                            trailingVisual: 'chevron-down',
                            styles: {
                              styleTemplate: 'hosp.header.userMenuTriggerMobile',
                              utilityClasses: 'min-w-0 max-w-[18ch] sm:max-w-[22ch] truncate'
                            },
                            titleI18nKey: 'nav.accountMenuTitle',
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
                            layout: { type: 'flex', flex: ['flex', 'flex-col', 'items-stretch', 'gap-1'] },
                            styles: {
                              utilityClasses:
                                'absolute left-0 top-[calc(100%+6px)] z-30 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-md'
                            },
                            children: [
                              {
                                id: 'hospital-public-header-user-menu-profile-mobile',
                                type: 'button',
                                config: {
                                  i18nKey: 'nav.profile',
                                  styles: { styleTemplate: 'hosp.header.menuButton', utilityClasses: 'w-full justify-start text-left' },
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
                                  i18nKey: 'nav.inactiveAccount',
                                  styles: { styleTemplate: 'hosp.header.menuButton', utilityClasses: 'w-full justify-start text-left' },
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
                                  i18nKey: 'nav.signOut',
                                  pendingI18nKey: 'nav.signingOut',
                                  styles: { styleTemplate: 'hosp.header.menuButton', utilityClasses: 'w-full justify-start text-left' },
                                  click: { actionId: 'logout-user' }
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
              id: 'hospital-public-header-actions-cta-row',
              type: 'container',
              config: {
                styles: { utilityClasses: 'flex w-auto shrink-0 justify-end' },
                children: [
                  {
                    id: 'hospital-public-header-cta',
                    type: 'button',
                    condition: visibleWhenNotLoggedInAsDoctor,
                    config: {
                      i18nKey: 'nav.bookNow',
                      styles: { styleTemplate: 'hosp.header.ctaButton' },
                      click: { actionId: 'open-appointment-popup' }
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
          i18nKey: 'nav.home',
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
          i18nKey: 'nav.home',
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
          i18nKey: 'nav.dashboard',
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
          i18nKey: 'nav.dashboard',
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
          i18nKey: 'nav.education',
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
          i18nKey: 'nav.education',
          styles: { styleTemplate: 'hosp.header.menuButton' },
          click: {
            actionId: 'set-education-header-active',
            onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'doctor-education' } }
          }
        }
      },
      {
        id: 'hospital-public-mobile-menu-blog-active',
        type: 'button',
        condition: {
          expression: "activeMenu === 'BLOG'",
          mappings: {
            activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
          }
        },
        config: {
          i18nKey: 'nav.blog',
          styles: { styleTemplate: 'hosp.header.menuButtonActive' },
          click: {
            actionId: 'set-blog-header-active',
            onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'blog' } }
          }
        }
      },
      {
        id: 'hospital-public-mobile-menu-blog',
        type: 'button',
        condition: {
          expression: "activeMenu !== 'BLOG'",
          mappings: {
            activeMenu: { packageName: 'hospital', key: 'HeaderUiState', property: 'activeMenu' }
          }
        },
        config: {
          i18nKey: 'nav.blog',
          styles: { styleTemplate: 'hosp.header.menuButton' },
          click: {
            actionId: 'set-blog-header-active',
            onSuccess: { actionType: 'navigate', navigate: { packageName: 'hospital', pageId: 'blog' } }
          }
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
  /** DPDP / health-data privacy notice. Pass empty string to hide. Default `privacy` when omitted. */
  privacyPageId?: string;
  /** When set, footer tagline uses `vue-i18n` (`i18nKey`); `tagline` is ignored for display. */
  taglineI18nKey?: string;
};

export function hospitalSiteFooter(
  footerRootId: string,
  tagline: string,
  options?: HospitalSiteFooterOptions
): ComponentDefinition {
  const termsPageId = options?.termsPageId !== undefined ? options.termsPageId.trim() : 'terms';
  const privacyPageId = options?.privacyPageId !== undefined ? options.privacyPageId.trim() : 'privacy';
  const showTermsLink = termsPageId.length > 0;
  const showPrivacyLink = privacyPageId.length > 0;

  const taglineFromI18n = Boolean(options?.taglineI18nKey && options.taglineI18nKey.trim().length > 0);
  const children: ComponentDefinition[] = [
    {
      id: `${footerRootId}-text`,
      type: 'text',
      config: taglineFromI18n
        ? {
            i18nKey: options!.taglineI18nKey!.trim(),
            styles: { utilityClasses: 'text-xs text-slate-500 text-center' }
          }
        : {
            text: tagline,
            styles: { utilityClasses: 'text-xs text-slate-500 text-center' }
          }
    }
  ];

  if (showTermsLink || showPrivacyLink) {
    const legalChildren: ComponentDefinition[] = [];
    if (showTermsLink) {
      legalChildren.push({
        id: `${footerRootId}-terms-link`,
        type: 'button',
        config: {
          i18nKey: 'footer.terms',
          styles: { styleTemplate: 'hosp.popup.linkButton' },
          click: {
            actionType: 'navigate',
            navigate: { packageName: 'hospital', pageId: termsPageId }
          }
        }
      });
    }
    if (showPrivacyLink) {
      legalChildren.push({
        id: `${footerRootId}-privacy-link`,
        type: 'button',
        config: {
          i18nKey: 'footer.privacyIndia',
          styles: { styleTemplate: 'hosp.popup.linkButton' },
          click: {
            actionType: 'navigate',
            navigate: { packageName: 'hospital', pageId: privacyPageId }
          }
        }
      });
    }
    children.push({
      id: `${footerRootId}-legal-row`,
      type: 'container',
      config: {
        layout: { type: 'flex', flex: ['flex', 'justify-center', 'items-center', 'flex-wrap', 'gap-3', 'pt-2'] },
        children: legalChildren
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
