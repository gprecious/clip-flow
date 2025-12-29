# Landing Page Section Patterns

Detailed patterns and code examples for each landing page section.

## Table of Contents

1. [Hero Section](#hero-section)
2. [Features/How-It-Works](#featureshow-it-works)
3. [Social Proof](#social-proof)
4. [Pricing](#pricing)
5. [Final CTA](#final-cta)
6. [Common Components](#common-components)

---

## Hero Section

The hero must capture attention in 3 seconds. Lead with the visitor's pain, not your product.

### Pattern: Problem-Solution Hero

```tsx
function Hero() {
  return (
    <section className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-4xl text-center">
        {/* Pain-focused headline */}
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          Stop Wasting Hours on <span className="text-primary">Manual Tasks</span>
        </h1>

        {/* Solution subheadline */}
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Automate your workflow in minutes. Save 10+ hours every week.
        </p>

        {/* Action-oriented CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg">Start Free Trial</Button>
          <Button size="lg" variant="outline">Watch Demo</Button>
        </div>

        {/* Objection removal */}
        <p className="text-sm text-muted-foreground mt-4">
          No credit card required. Setup in 2 minutes.
        </p>
      </div>
    </section>
  );
}
```

### Headline Formulas

| Formula | Example |
|---------|---------|
| Stop [Pain] | Stop losing leads to slow responses |
| [Benefit] without [Pain] | Scale your business without hiring |
| The [Solution] that [Benefit] | The CRM that closes deals for you |
| [Number] [Result] in [Time] | 10x your conversions in 30 days |

---

## Features/How-It-Works

Show your solution in 3-4 concrete steps. Use visuals and keep each step scannable.

### Pattern: Numbered Steps

```tsx
const steps = [
  {
    number: "01",
    title: "Connect Your Tools",
    description: "Integrate with 100+ apps in one click. No coding required.",
  },
  {
    number: "02",
    title: "Build Your Workflow",
    description: "Drag and drop to create automated processes in minutes.",
  },
  {
    number: "03",
    title: "Watch It Work",
    description: "Sit back as tasks complete automatically, 24/7.",
  },
];

function HowItWorks() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-16">
          How It Works
        </h2>

        <div className="grid md:grid-cols-3 gap-12">
          {steps.map((step) => (
            <div key={step.number} className="text-center">
              <span className="text-5xl font-bold text-primary/20">
                {step.number}
              </span>
              <h3 className="text-xl font-semibold mt-4 mb-2">
                {step.title}
              </h3>
              <p className="text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### Pattern: Feature Grid

```tsx
const features = [
  { icon: Zap, title: "Lightning Fast", description: "..." },
  { icon: Shield, title: "Secure by Default", description: "..." },
  { icon: Clock, title: "24/7 Automation", description: "..." },
  { icon: Users, title: "Team Collaboration", description: "..." },
];

function Features() {
  return (
    <section className="py-24 px-4 bg-muted/50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">
          Everything You Need
        </h2>
        <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
          Powerful features to transform your workflow
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <Card key={feature.title} className="p-6">
              <feature.icon className="h-10 w-10 text-primary mb-4" />
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## Social Proof

Show that people like your visitor have succeeded. Be specific and quantifiable.

### Pattern: Testimonials with Results

```tsx
const testimonials = [
  {
    quote: "We reduced response time from 24 hours to 15 minutes. Our customers love it.",
    author: "Sarah Kim",
    role: "Head of Support, TechCorp",
    image: "/testimonials/sarah.jpg",
    metric: "96% faster response",
  },
  // ...
];

function Testimonials() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">
          Trusted by 10,000+ Teams
        </h2>

        {/* Logo bar */}
        <div className="flex justify-center gap-12 opacity-50 mb-16">
          {logos.map((logo) => (
            <img key={logo.name} src={logo.src} alt={logo.name} className="h-8" />
          ))}
        </div>

        {/* Testimonial cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t) => (
            <Card key={t.author} className="p-6">
              {/* Result highlight */}
              <span className="text-2xl font-bold text-primary">
                {t.metric}
              </span>

              <blockquote className="mt-4 text-muted-foreground">
                "{t.quote}"
              </blockquote>

              <div className="flex items-center gap-3 mt-6">
                <img src={t.image} className="w-10 h-10 rounded-full" />
                <div>
                  <p className="font-medium">{t.author}</p>
                  <p className="text-sm text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### Pattern: Stats Bar

```tsx
const stats = [
  { value: "10,000+", label: "Active Users" },
  { value: "99.9%", label: "Uptime" },
  { value: "4.9/5", label: "User Rating" },
  { value: "2M+", label: "Tasks Automated" },
];

function StatsBar() {
  return (
    <section className="py-12 bg-primary text-primary-foreground">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-4xl font-bold">{stat.value}</p>
            <p className="text-sm opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

---

## Pricing

Keep pricing simple. Highlight the recommended plan. Show value, not just features.

### Pattern: 3-Tier Pricing

```tsx
const plans = [
  {
    name: "Starter",
    price: "$9",
    description: "For individuals",
    features: ["5 workflows", "1,000 tasks/mo", "Email support"],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    description: "For growing teams",
    features: ["Unlimited workflows", "50,000 tasks/mo", "Priority support", "API access"],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For large organizations",
    features: ["Everything in Pro", "Unlimited tasks", "Dedicated support", "SLA"],
    cta: "Contact Sales",
    highlighted: false,
  },
];

function Pricing() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">
          Simple, Transparent Pricing
        </h2>
        <p className="text-center text-muted-foreground mb-16">
          Start free. Upgrade when you're ready.
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                "p-6",
                plan.highlighted && "border-primary shadow-lg scale-105"
              )}
            >
              {plan.highlighted && (
                <Badge className="mb-4">Most Popular</Badge>
              )}
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="text-muted-foreground text-sm">{plan.description}</p>

              <p className="text-4xl font-bold my-6">
                {plan.price}
                {plan.price !== "Custom" && <span className="text-lg">/mo</span>}
              </p>

              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                variant={plan.highlighted ? "default" : "outline"}
              >
                {plan.cta}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## Final CTA

Repeat your core value proposition. Remove final objections. Make the button impossible to miss.

### Pattern: Final CTA Section

```tsx
function FinalCTA() {
  return (
    <section className="py-24 px-4 bg-primary text-primary-foreground">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Ready to Save 10 Hours Every Week?
        </h2>
        <p className="text-lg opacity-90 mb-8">
          Join 10,000+ teams automating their workflow with us.
        </p>

        <Button size="lg" variant="secondary" className="text-lg px-8">
          Start Your Free Trial
        </Button>

        <p className="text-sm opacity-70 mt-4">
          No credit card required. Cancel anytime.
        </p>
      </div>
    </section>
  );
}
```

---

## Common Components

### Navbar

```tsx
function Navbar() {
  return (
    <nav className="fixed top-0 w-full bg-background/80 backdrop-blur-sm border-b z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Logo />

        <div className="hidden md:flex items-center gap-8">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#testimonials">Testimonials</a>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost">Log In</Button>
          <Button>Get Started</Button>
        </div>
      </div>
    </nav>
  );
}
```

### Footer

```tsx
function Footer() {
  return (
    <footer className="py-12 px-4 border-t">
      <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-8">
        <div>
          <Logo />
          <p className="text-sm text-muted-foreground mt-2">
            Automate your workflow. Save time.
          </p>
        </div>

        {footerLinks.map((section) => (
          <div key={section.title}>
            <h4 className="font-semibold mb-4">{section.title}</h4>
            <ul className="space-y-2">
              {section.links.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
```
