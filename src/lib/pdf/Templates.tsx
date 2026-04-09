'use client';

import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

// Standard A4 styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1a3c34',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2pt solid #c5a059',
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a3c34',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 8,
    color: '#c5a059',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 20,
    textTransform: 'uppercase',
    color: '#c5a059',
  },
  table: {
    display: 'flex',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
  },
  tableColHeader: {
    backgroundColor: '#f9fafb',
    padding: 8,
    borderRightColor: '#e5e7eb',
    borderRightWidth: 1,
  },
  tableCol: {
    padding: 8,
    borderRightColor: '#e5e7eb',
    borderRightWidth: 1,
  },
  colTextHeader: {
    fontWeight: 'bold',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
    borderTop: '1pt solid #e5e7eb',
    paddingTop: 10,
  }
});

// Template for "All Toko" Rekap
export const AllTokoPDF = ({ date, items }: { date: string, items: any[] }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>RADEN</Text>
          <Text style={styles.subtitle}>Sistem Operasional Produksi</Text>
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text style={{ fontSize: 12, fontWeight: 'bold' }}>REKAP ALL TOKO</Text>
          <Text style={{ color: '#6b7280' }}>Tanggal: {date}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Total Produksi Harian</Text>
      
      <View style={styles.table}>
        <View style={styles.tableRow}>
          <View style={[styles.tableColHeader, { flex: 3 }]}><Text style={styles.colTextHeader}>Nama Produk</Text></View>
          <View style={[styles.tableColHeader, { flex: 1, textAlign: 'center' }]}><Text style={styles.colTextHeader}>Total Qty</Text></View>
        </View>
        {items.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <View style={[styles.tableCol, { flex: 3 }]}><Text>{item.product}</Text></View>
            <View style={[styles.tableCol, { flex: 1, textAlign: 'center' }]}><Text style={{ fontWeight: 'bold' }}>{item.total}</Text></View>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>Dicetak pada: {new Date().toLocaleString('id-ID')} • RADEN cookies & co</Text>
    </Page>
  </Document>
);

// Template for Order Bon
export const OrderBonPDF = ({ order }: { order: any }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>RADEN</Text>
          <Text style={styles.subtitle}>Cookies & Co</Text>
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold' }}>BON PESANAN</Text>
          <Text style={{ color: '#6b7280' }}>#{order.id}</Text>
        </View>
      </View>

      <View style={{ marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: '#9ca3af', textTransform: 'uppercase', fontSize: 8, marginBottom: 4 }}>Pelanggan:</Text>
          <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{order.customer}</Text>
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text style={{ color: '#9ca3af', textTransform: 'uppercase', fontSize: 8, marginBottom: 4 }}>Tanggal:</Text>
          <Text>{order.date}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableRow}>
          <View style={[styles.tableColHeader, { flex: 3 }]}><Text style={styles.colTextHeader}>Item</Text></View>
          <View style={[styles.tableColHeader, { flex: 1, textAlign: 'center' }]}><Text style={styles.colTextHeader}>Qty</Text></View>
        </View>
        {order.items.map((item: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <View style={[styles.tableCol, { flex: 3 }]}><Text>{item.name}</Text></View>
            <View style={[styles.tableCol, { flex: 1, textAlign: 'center' }]}><Text>{item.qty}</Text></View>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 20, padding: 10, backgroundColor: '#f9fafb', borderRadius: 4, textAlign: 'right' }}>
        <Text style={{ fontSize: 14, fontWeight: 'bold' }}>Status: SIAP KIRIM</Text>
      </View>

      <Text style={styles.footer}>Terima kasih telah berbelanja di RADEN • Manisnya Kebersamaan</Text>
    </Page>
  </Document>
);
