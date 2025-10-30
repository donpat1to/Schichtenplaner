import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import StepSetup from './StepSetup';

const mockSteps = [
  { id: 'step-1', title: 'First Step', subtitle: 'Description 1' },
  { id: 'step-2', title: 'Second Step' },
  { id: 'step-3', title: 'Third Step', subtitle: 'Description 3', optional: true },
];

describe('StepSetup', () => {
  // a) Test verschiedener Step-Counts
  test('renders correct number of steps', () => {
    render(<StepSetup steps={mockSteps} />);
    
    expect(screen.getByText('First Step')).toBeInTheDocument();
    expect(screen.getByText('Second Step')).toBeInTheDocument();
    expect(screen.getByText('Third Step')).toBeInTheDocument();
  });

  test('renders empty state correctly', () => {
    render(<StepSetup steps={[]} />);
    
    expect(screen.getByText('No steps available')).toBeInTheDocument();
  });

  // b) Keyboard-Navigation und Klicks
  test('handles click navigation when clickable', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    
    render(<StepSetup steps={mockSteps} clickable={true} onChange={onChange} />);
    
    const secondStep = screen.getByRole('tab', { name: /second step/i });
    await user.click(secondStep);
    
    expect(onChange).toHaveBeenCalledWith(1);
  });

  test('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    
    render(
      <StepSetup 
        steps={mockSteps} 
        defaultCurrent={0} 
        onChange={onChange} 
      />
    );

    const firstStep = screen.getByRole('tab', { name: /first step/i });
    firstStep.focus();
    
    // Right arrow to next step
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith(1);
    
    // Home key to first step
    await user.keyboard('{Home}');
    expect(onChange).toHaveBeenCalledWith(0);
    
    // End key to last step  
    await user.keyboard('{End}');
    expect(onChange).toHaveBeenCalledWith(2);
  });

  // c) ARIA-Attribute Tests
  test('has correct ARIA attributes', () => {
    render(<StepSetup steps={mockSteps} current={1} />);
    
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();
    
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    
    // Second step should be selected
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-current', 'step');
  });

  // d) Controlled vs Uncontrolled Tests
  test('works in controlled mode', () => {
    const onChange = jest.fn();
    
    const { rerender } = render(
      <StepSetup steps={mockSteps} current={0} onChange={onChange} />
    );
    
    // Click should call onChange but not change internal state in controlled mode
    const secondStep = screen.getByRole('tab', { name: /second step/i });
    fireEvent.click(secondStep);
    
    expect(onChange).toHaveBeenCalledWith(1);
    // Current step should still be first (controlled by prop)
    expect(screen.getByRole('tab', { name: /first step/i }))
      .toHaveAttribute('aria-selected', 'true');
    
    // Update prop should change current step
    rerender(<StepSetup steps={mockSteps} current={1} onChange={onChange} />);
    expect(screen.getByRole('tab', { name: /second step/i }))
      .toHaveAttribute('aria-selected', 'true');
  });

  test('works in uncontrolled mode', () => {
    const onChange = jest.fn();
    
    render(<StepSetup steps={mockSteps} defaultCurrent={0} onChange={onChange} />);
    
    const secondStep = screen.getByRole('tab', { name: /second step/i });
    fireEvent.click(secondStep);
    
    expect(onChange).toHaveBeenCalledWith(1);
    expect(secondStep).toHaveAttribute('aria-selected', 'true');
  });

  test('clamps out-of-range current values', () => {
    render(<StepSetup steps={mockSteps} current={10} />);
    
    // Should clamp to last step
    const lastStep = screen.getByRole('tab', { name: /third step/i });
    expect(lastStep).toHaveAttribute('aria-selected', 'true');
  });
});