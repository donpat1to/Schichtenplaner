import React, { useState, useEffect } from 'react';
import { TimeSlot } from '../../models/ShiftPlan';
import {
    ICONS,
    addTextButton,
    deleteTextButton,
    cancelTextButton,
    borderlessEditButton,
} from '../../utils/buttonStyles';
import Modal from '../Modal/Modal';

interface TimeSlotEditorProps {
    slot: TimeSlot;
    onUpdate: (slot: TimeSlot, name: string, startTime: string, endTime: string, description?: string) => void;
    onDelete: (slotId: string) => void;
    shiftsCount: number;
    disabled?: boolean;
}

const TimeSlotEditor: React.FC<TimeSlotEditorProps> = ({
    slot,
    onUpdate,
    onDelete,
    shiftsCount,
    disabled = false
}) => {
    const [showModal, setShowModal] = useState(false);
    const [name, setName] = useState(slot.name);
    const [startTime, setStartTime] = useState(slot.startTime);
    const [endTime, setEndTime] = useState(slot.endTime);
    const [description, setDescription] = useState(slot.description || '');

    useEffect(() => {
        setName(slot.name);
        setStartTime(slot.startTime);
        setEndTime(slot.endTime);
        setDescription(slot.description || '');
    }, [slot]);

    const handleEditClick = () => {
        if (disabled) return;
        setShowModal(true);
    };

    const handleSave = () => {
        onUpdate(slot, name, startTime, endTime, description || undefined);
        setShowModal(false);
    };

    const handleDelete = () => {
        onDelete(slot.id);
        setShowModal(false);
    };

    const handleClose = () => {
        setName(slot.name);
        setStartTime(slot.startTime);
        setEndTime(slot.endTime);
        setDescription(slot.description || '');
        setShowModal(false);
    };

    const formatTime = (time: string) => {
        return time.substring(0, 5);
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px',
        borderRadius: '4px',
        border: '1px solid #ddd',
        fontSize: '14px',
        boxSizing: 'border-box',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        marginBottom: '6px',
        fontWeight: 'bold',
        fontSize: '14px',
        color: '#2c3e50',
    };

    return (
        <>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
            }}>
                <button
                    onClick={handleEditClick}
                    style={borderlessEditButton(disabled)}
                    title="Zeit-Slot bearbeiten"
                    disabled={disabled}
                >
                    {ICONS.edit}
                </button>
                <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#2c3e50' }}>
                        {slot.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                        {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </div>
                </div>
            </div>

            <Modal
                isOpen={showModal}
                onClose={handleClose}
                title="Zeit-Slot bearbeiten"
                width="400px"
            >
                <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>Name *</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        style={inputStyle}
                        placeholder="z.B. Vormittag"
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                        <label style={labelStyle}>Startzeit *</label>
                        <input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Endzeit *</label>
                        <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>Beschreibung (optional)</label>
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        style={inputStyle}
                        placeholder="Optionale Beschreibung"
                    />
                </div>

                {shiftsCount > 0 && (
                    <div style={{
                        marginBottom: '16px',
                        padding: '12px',
                        backgroundColor: '#fff3cd',
                        borderRadius: '4px',
                        fontSize: '13px',
                        color: '#856404',
                        border: '1px solid #ffc107',
                    }}>
                        Dieser Zeit-Slot enthält {shiftsCount} Schicht(en). Beim Löschen werden alle zugehörigen Schichten entfernt.
                    </div>
                )}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleSave}
                        disabled={!name}
                        style={addTextButton(!name)}
                    >
                        Speichern
                    </button>
                    <button
                        onClick={handleDelete}
                        style={deleteTextButton(false)}
                        title={shiftsCount > 0 ? `Enthält ${shiftsCount} Schicht(en)` : undefined}
                    >
                        {ICONS.delete} Löschen
                    </button>
                    <button
                        onClick={handleClose}
                        style={cancelTextButton(false)}
                    >
                        Abbrechen
                    </button>
                </div>
            </Modal>
        </>
    );
};

export default TimeSlotEditor;