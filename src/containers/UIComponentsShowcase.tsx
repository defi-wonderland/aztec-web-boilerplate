import React, { useState } from 'react';
import {
  Layers,
  Copy,
  Rocket,
  X,
  Sun,
  Moon,
  Bell,
  Check,
  AlertTriangle,
  Info,
  XCircle,
  // Icon examples
  Home,
  Settings,
  User,
  Search,
  Heart,
  Star,
  Mail,
  Calendar,
  Camera,
  Download,
  Upload,
  Trash2,
  Edit,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Toggle,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../components/ui';
import { useToast } from '../hooks';

const styles = {
  headerRow: 'flex flex-row items-start gap-4',
  headerIcon: 'h-8 w-8 text-accent',
  // Sections
  sectionsContainer: 'space-y-8',
  section: 'space-y-4',
  sectionTitle:
    'text-lg font-semibold text-default border-b border-default pb-2',
  sectionDescription: 'text-sm text-muted',
  // Component showcase
  componentGrid: 'flex flex-wrap gap-3 items-center',
  componentRow: 'flex flex-wrap gap-3 items-end',
  componentColumn: 'flex flex-col gap-3',
  // Labels
  variantLabel: 'text-xs text-muted font-mono',
  // Icons
  icon: {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
  },
  // Tab content
  tabContent: 'p-4 bg-surface-secondary rounded-lg mt-2',
  // Dialog
  dialogBody: 'py-4',
  dialogText: 'text-default',
  // Card examples
  cardExample: 'max-w-xs',
  cardText: 'text-sm text-muted',
  cardTextDefault: 'text-sm text-default',
  // Icons section
  iconGrid: 'grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-4',
  iconItem: 'flex flex-col items-center gap-1',
  iconBox:
    'p-3 rounded-lg bg-surface-secondary hover:bg-surface-tertiary transition-colors',
  iconName: 'text-[10px] text-muted font-mono truncate max-w-full',
  link: 'text-accent hover:underline inline-flex items-center gap-1',
  // Guidelines section
  guidelineBox:
    'p-4 rounded-lg bg-surface-secondary border border-default space-y-2',
  guidelineTitle: 'font-semibold text-default flex items-center gap-2',
  guidelineText: 'text-sm text-muted',
  guidelineList: 'list-disc list-inside text-sm text-muted space-y-1 ml-2',
} as const;

/**
 * Showcase of all UI components and their variants.
 * Acts as living documentation for the design system.
 */
export const UIComponentsShowcase: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [togglePressed, setTogglePressed] = useState(false);
  const { success, error, warning, info, loading } = useToast();

  return (
    <Card>
      <CardHeader className={styles.headerRow}>
        <Layers className={styles.headerIcon} />
        <div>
          <CardTitle>UI Components</CardTitle>
          <CardDescription>
            Design system documentation - all available components and variants
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className={styles.sectionsContainer}>
        {/* ============ BUTTONS ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Buttons</h3>
          <p className={styles.sectionDescription}>
            Button variants for different actions and contexts.
          </p>

          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>Variants</span>
            <div className={styles.componentGrid}>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="danger-outline">Danger Outline</Button>
            </div>
          </div>

          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>Sizes</span>
            <div className={styles.componentGrid}>
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
          </div>

          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>With Icons</span>
            <div className={styles.componentGrid}>
              <Button icon={<Rocket className={styles.icon.sm} />}>
                Deploy
              </Button>
              <Button
                variant="secondary"
                icon={<Copy className={styles.icon.sm} />}
              >
                Copy
              </Button>
            </div>
          </div>

          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>Icon Buttons</span>
            <div className={styles.componentGrid}>
              <Button variant="icon" size="icon">
                <Copy className={styles.icon.sm} />
              </Button>
              <Button variant="icon" size="icon">
                <X className={styles.icon.sm} />
              </Button>
              <Button variant="toggle" size="icon">
                <Sun className={styles.icon.sm} />
              </Button>
            </div>
          </div>

          <div className={styles.componentColumn}>
            <span className={styles.variantLabel}>States</span>
            <div className={styles.componentGrid}>
              <Button isLoading>Loading</Button>
              <Button disabled>Disabled</Button>
            </div>
          </div>
        </section>

        {/* ============ INPUTS ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Inputs</h3>
          <p className={styles.sectionDescription}>
            Text input fields with labels, helpers, and error states.
          </p>

          <div className={styles.componentRow}>
            <Input
              label="Default Input"
              placeholder="Type something..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <Input
              label="With Helper"
              placeholder="Enter value"
              helperText="This is a helper text"
            />
            <Input
              label="With Error"
              placeholder="Invalid input"
              hasError
              error="This field is required"
            />
            <Input label="Disabled" placeholder="Can't edit" disabled />
          </div>
        </section>

        {/* ============ TEXTAREA ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Textarea</h3>
          <p className={styles.sectionDescription}>
            Multi-line text input for longer content.
          </p>

          <div className={styles.componentRow}>
            <Textarea
              label="Default Textarea"
              placeholder="Enter your message..."
              value={textareaValue}
              onChange={(e) => setTextareaValue(e.target.value)}
              rows={3}
            />
            <Textarea
              label="With Error"
              placeholder="Invalid content"
              hasError
              error="Content is too short"
              rows={3}
            />
          </div>
        </section>

        {/* ============ SELECT ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Select</h3>
          <p className={styles.sectionDescription}>
            Dropdown selection with Radix UI primitives.
          </p>

          <div className={styles.componentGrid}>
            <div className={styles.componentColumn}>
              <span className={styles.variantLabel}>Default</span>
              <Select value={selectValue} onValueChange={setSelectValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select option..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="option1">Option 1</SelectItem>
                  <SelectItem value="option2">Option 2</SelectItem>
                  <SelectItem value="option3">Option 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={styles.componentColumn}>
              <span className={styles.variantLabel}>Disabled</span>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Disabled..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="x">X</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* ============ BADGES ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Badges</h3>
          <p className={styles.sectionDescription}>
            Status indicators and labels.
          </p>

          <div className={styles.componentGrid}>
            <Badge variant="default">Default</Badge>
            <Badge variant="primary">Primary</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
            <Badge variant="info">Info</Badge>
          </div>
        </section>

        {/* ============ ICONS ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Icons</h3>
          <p className={styles.sectionDescription}>
            All icons should be imported from{' '}
            <a
              href="https://lucide.dev/icons/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              Lucide React
              <ExternalLink className={styles.icon.sm} />
            </a>
            . Use consistent sizing via the styles object (h-4 w-4 for sm, h-5
            w-5 for md).
          </p>

          <div className={styles.iconGrid}>
            {[
              { Icon: Home, name: 'Home' },
              { Icon: Settings, name: 'Settings' },
              { Icon: User, name: 'User' },
              { Icon: Search, name: 'Search' },
              { Icon: Heart, name: 'Heart' },
              { Icon: Star, name: 'Star' },
              { Icon: Mail, name: 'Mail' },
              { Icon: Calendar, name: 'Calendar' },
              { Icon: Camera, name: 'Camera' },
              { Icon: Download, name: 'Download' },
              { Icon: Upload, name: 'Upload' },
              { Icon: Trash2, name: 'Trash2' },
              { Icon: Edit, name: 'Edit' },
              { Icon: Copy, name: 'Copy' },
              { Icon: Check, name: 'Check' },
              { Icon: X, name: 'X' },
              { Icon: Info, name: 'Info' },
              { Icon: AlertTriangle, name: 'AlertTriangle' },
            ].map(({ Icon, name }) => (
              <div key={name} className={styles.iconItem}>
                <div className={styles.iconBox}>
                  <Icon className={styles.icon.md} />
                </div>
                <span className={styles.iconName}>{name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ============ TOGGLE ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Toggle</h3>
          <p className={styles.sectionDescription}>
            Radix UI toggle button with pressed state.
          </p>

          <div className={styles.componentGrid}>
            <div className={styles.componentColumn}>
              <span className={styles.variantLabel}>Default</span>
              <Toggle
                pressed={togglePressed}
                onPressedChange={setTogglePressed}
              >
                {togglePressed ? (
                  <Moon className={styles.icon.sm} />
                ) : (
                  <Sun className={styles.icon.sm} />
                )}
              </Toggle>
            </div>

            <div className={styles.componentColumn}>
              <span className={styles.variantLabel}>Ghost</span>
              <Toggle variant="ghost">
                <Bell className={styles.icon.sm} />
              </Toggle>
            </div>
          </div>
        </section>

        {/* ============ TOOLTIP ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Tooltip</h3>
          <p className={styles.sectionDescription}>
            Hover to reveal additional information.
          </p>

          <div className={styles.componentGrid}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary">Hover me</Button>
              </TooltipTrigger>
              <TooltipContent>This is a tooltip!</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="icon" size="icon">
                  <Info className={styles.icon.sm} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Information tooltip</TooltipContent>
            </Tooltip>
          </div>
        </section>

        {/* ============ TABS ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Tabs</h3>
          <p className={styles.sectionDescription}>
            Radix UI tabs for content organization.
          </p>

          <Tabs defaultValue="tab1">
            <TabsList>
              <TabsTrigger value="tab1">Tab 1</TabsTrigger>
              <TabsTrigger value="tab2">Tab 2</TabsTrigger>
              <TabsTrigger value="tab3">Tab 3</TabsTrigger>
            </TabsList>
            <TabsContent value="tab1">
              <div className={styles.tabContent}>Content for Tab 1</div>
            </TabsContent>
            <TabsContent value="tab2">
              <div className={styles.tabContent}>Content for Tab 2</div>
            </TabsContent>
            <TabsContent value="tab3">
              <div className={styles.tabContent}>Content for Tab 3</div>
            </TabsContent>
          </Tabs>
        </section>

        {/* ============ DIALOG / MODAL ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Dialog / Modal</h3>
          <p className={styles.sectionDescription}>
            Radix UI dialog for modal content.
          </p>

          <div className={styles.componentGrid}>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Open Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dialog Title</DialogTitle>
                  <DialogDescription>
                    This is a dialog description. It provides context about the
                    dialog content.
                  </DialogDescription>
                </DialogHeader>
                <div className={styles.dialogBody}>
                  <p className={styles.dialogText}>
                    Dialog body content goes here. You can put any content
                    inside the dialog.
                  </p>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button>Confirm</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        {/* ============ TOASTS ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Toasts</h3>
          <p className={styles.sectionDescription}>
            Notification toasts with different variants.
          </p>

          <div className={styles.componentGrid}>
            <Button
              variant="secondary"
              onClick={() =>
                success('Success!', 'Operation completed successfully')
              }
              icon={<Check className={styles.icon.sm} />}
            >
              Success Toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => error('Error!', 'Something went wrong')}
              icon={<XCircle className={styles.icon.sm} />}
            >
              Error Toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => warning('Warning!', 'Please review this action')}
              icon={<AlertTriangle className={styles.icon.sm} />}
            >
              Warning Toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => info('Info', 'Here is some information')}
              icon={<Info className={styles.icon.sm} />}
            >
              Info Toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const toast = loading('Loading...', 'Please wait');
                setTimeout(
                  () => toast.success('Done!', 'Loading complete'),
                  2000
                );
              }}
            >
              Loading Toast
            </Button>
          </div>
        </section>

        {/* ============ CARDS ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Cards</h3>
          <p className={styles.sectionDescription}>
            Card containers with header, content, and footer sections.
          </p>

          <div className={styles.componentRow}>
            <Card className={styles.cardExample}>
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>Card description text</CardDescription>
              </CardHeader>
              <CardContent>
                <p className={styles.cardText}>
                  This is the card content area where main information is
                  displayed.
                </p>
              </CardContent>
            </Card>

            <Card padding="sm" className={styles.cardExample}>
              <CardContent>
                <p className={styles.cardTextDefault}>
                  Compact card with small padding.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ============ DEVELOPMENT GUIDELINES ============ */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Development Guidelines</h3>
          <p className={styles.sectionDescription}>
            Best practices for extending the component library.
          </p>

          <div className={styles.guidelineBox}>
            <div className={styles.guidelineTitle}>
              <BookOpen className={styles.icon.md} />
              Adding New Components
            </div>
            <p className={styles.guidelineText}>
              When you need a new UI component, always check{' '}
              <a
                href="https://www.radix-ui.com/primitives/docs/overview/introduction"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                Radix UI Primitives
                <ExternalLink className={styles.icon.sm} />
              </a>{' '}
              first. If the component exists there, you must use it as the base.
            </p>
            <ul className={styles.guidelineList}>
              <li>Radix provides accessible, unstyled primitives</li>
              <li>Style with Tailwind using the semantic styles pattern</li>
              <li>Export from src/components/ui/index.ts</li>
              <li>Add examples to this showcase</li>
            </ul>
          </div>
        </section>
      </CardContent>
    </Card>
  );
};
