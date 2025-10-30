import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import StepSetup from './StepSetup';

const meta: Meta<typeof StepSetup> = {
  title: 'Components/StepSetup',
  component: StepSetup,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof StepSetup>;

const defaultSteps = [
  { id: 'step-1', title: 'Account Setup', subtitle: 'Create your account' },
  { id: 'step-2', title: 'Profile Information', subtitle: 'Add personal details' },
  { id: 'step-3', title: 'Preferences', subtitle: 'Customize your experience', optional: true },
  { id: 'step-4', title: 'Confirmation', subtitle: 'Review and confirm' },
];

export const Horizontal: Story = {
  args: {
    steps: defaultSteps,
    defaultCurrent: 1,
    orientation: 'horizontal',
  },
};

export const Vertical: Story = {
  args: {
    steps: defaultSteps,
    defaultCurrent: 1,
    orientation: 'vertical',
  },
  parameters: {
    layout: 'padded',
  },
};

export const ClickableFalse: Story = {
  args: {
    steps: defaultSteps,
    current: 2,
    clickable: false,
  },
  name: 'Non-Clickable Steps',
};

export const AnimatedFalse: Story = {
  args: {
    steps: defaultSteps,
    defaultCurrent: 1,
    animated: false,
  },
  name: 'Without Animation',
};

export const DifferentSizes: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium mb-2">Small</h3>
        <StepSetup steps={defaultSteps} size="sm" defaultCurrent={1} />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">Medium (default)</h3>
        <StepSetup steps={defaultSteps} size="md" defaultCurrent={1} />
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">Large</h3>
        <StepSetup steps={defaultSteps} size="lg" defaultCurrent={1} />
      </div>
    </div>
  ),
  name: 'Different Sizes',
};