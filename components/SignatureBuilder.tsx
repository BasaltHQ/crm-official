'use client';

import React, { useState, useEffect } from 'react';

import { FaFacebook, FaXTwitter, FaLinkedin, FaInstagram, FaMedium, FaPatreon, FaDiscord } from 'react-icons/fa6';

interface SignatureData {
  firstName: string;
  lastName: string;
  title: string;
  department: string;
  phone: string;
  email: string;
  website: string;
  profileImage: string;
  companyLogoUrl: string;
  companyTagline: string;
  accentColor: string;
  template: 'professional' | 'modern' | 'minimalist' | 'executive';
  showSocial: boolean;
  showTagline: boolean;
  showMedallions: boolean;
}

interface SignatureBuilderProps {
  hasAccess: boolean;
}

const SignatureBuilder: React.FC<SignatureBuilderProps> = ({ hasAccess }) => {
  // thirdweb wallet not required; removing active account dependency
  const [signatureData, setSignatureData] = useState<SignatureData>({
    firstName: '',
    lastName: '',
    title: '',
    department: '',
    phone: '',
    email: '',
    website: 'theutilitycompany.co',
    profileImage: '',
    companyLogoUrl: 'https://storage.googleapis.com/tgl_cdn/images/Medallions/TUC.png',
    companyTagline: 'Simple Choices. Complex Outcomes.',
    accentColor: '#F54029',
    template: 'professional',
    showSocial: true,
    showTagline: true,
    showMedallions: true,
  });
  const [copiedToClipboard, setCopiedToClipboard] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedStatus, setSavedStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  // Hydrate from saved signature when builder mounts
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/profile/signature', { method: 'GET' });
        if (!res.ok) return;
        const data = await res.json();
        const meta = data?.signature_meta;
        if (meta && typeof meta === 'object') {
          setSignatureData((prev) => ({
            ...prev,
            firstName: meta.firstName ?? prev.firstName,
            lastName: meta.lastName ?? prev.lastName,
            title: meta.title ?? prev.title,
            department: meta.department ?? prev.department,
            phone: meta.phone ?? prev.phone,
            email: meta.email ?? prev.email,
            website: meta.website ?? prev.website,
            profileImage: meta.profileImage ?? prev.profileImage,
            companyLogoUrl: meta.companyLogoUrl ?? prev.companyLogoUrl,
            accentColor: meta.accentColor ?? prev.accentColor,
            template: meta.template ?? prev.template,
            showSocial: typeof meta.showSocial === 'boolean' ? meta.showSocial : prev.showSocial,
            showTagline: typeof meta.showTagline === 'boolean' ? meta.showTagline : prev.showTagline,
            showMedallions: typeof meta.showMedallions === 'boolean' ? meta.showMedallions : prev.showMedallions,
          }));
        }
      } catch {
        // ignore hydration errors
      }
    })();
  }, []);


  const handleInputChange = (field: keyof SignatureData, value: string | boolean) => {
    setSignatureData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    let phoneNumber = value.replace(/\D/g, '');
    
    // If it starts with 1, remove it (assume it's the country code)
    if (phoneNumber.startsWith('1') && phoneNumber.length > 1) {
      phoneNumber = phoneNumber.slice(1);
    }
    
    // Limit to 10 digits for US numbers
    phoneNumber = phoneNumber.slice(0, 10);
    
    // Format as +1 (XXX) XXX-XXXX
    if (phoneNumber.length === 0) return '';
    if (phoneNumber.length <= 3) return `+1 (${phoneNumber}`;
    if (phoneNumber.length <= 6) return `+1 (${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    return `+1 (${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
  };

  const handlePhoneChange = (value: string) => {
    const formattedPhone = formatPhoneNumber(value);
    handleInputChange('phone', formattedPhone);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      // Client-side compress to max 1000x1000 to avoid server body size limits
      const reader = new FileReader();
      const dataURL: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = dataURL;
      });
      const maxSide = 1000;
      const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
      const targetW = Math.round(img.width * scale);
      const targetH = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported by this browser');
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const mime = file.type || 'image/jpeg';
      const quality = mime.includes('jpeg') || mime.includes('jpg') ? 0.85 : undefined;
      const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), mime, quality));
      const compressedFile = new File([blob], file.name, { type: mime });

      const formData = new FormData();
      formData.append('file', compressedFile);

      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const result = await response.json();

      if (response.ok && result?.document?.document_file_url) {
        handleInputChange('profileImage', result.document.document_file_url);
      } else {
        const errMsg = result?.error || 'Failed to upload image';
        alert(errMsg);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error?.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleCompanyLogoUpload = async (file: File) => {
    setUploading(true);
    try {
      // Client-side compress to max 1000x1000 to avoid server body size limits
      const reader = new FileReader();
      const dataURL: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = dataURL;
      });
      const maxSide = 1000;
      const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
      const targetW = Math.round(img.width * scale);
      const targetH = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported by this browser');
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const mime = file.type || 'image/png';
      const quality = mime.includes('jpeg') || mime.includes('jpg') ? 0.85 : undefined;
      const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), mime, quality));
      const compressedFile = new File([blob], file.name, { type: mime });

      const formData = new FormData();
      formData.append('file', compressedFile);

      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const result = await response.json();

      if (response.ok && result?.document?.document_file_url) {
        handleInputChange('companyLogoUrl', result.document.document_file_url);
      } else {
        const errMsg = result?.error || 'Failed to upload logo';
        alert(errMsg);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error?.message || 'Failed to upload logo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Helper function to convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : "245, 64, 41";
  };

  // Generate CSS filter to colorize icons to match accent color
  const getEmojiFilter = (hexColor: string) => {
    // For #F54029 (TUC brand red), use a specific optimized filter
    if (hexColor.toUpperCase() === '#F54029') {
      return 'brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)';
    }
    
    // For other colors, convert hex to RGB and generate filter
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // Convert to HSL for better filter control
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const diff = max - min;
    const lightness = (max + min) / 2;
    
    let hue = 0;
    if (diff !== 0) {
      if (max === rNorm) {
        hue = ((gNorm - bNorm) / diff + (gNorm < bNorm ? 6 : 0)) * 60;
      } else if (max === gNorm) {
        hue = ((bNorm - rNorm) / diff + 2) * 60;
      } else {
        hue = ((rNorm - gNorm) / diff + 4) * 60;
      }
    }
    
    // Generate filter based on color properties
    const saturation = Math.max(100, Math.min(300, lightness < 0.5 ? 200 : 150));
    const brightness = Math.max(90, Math.min(130, lightness * 100 + 30));
    const hueRotate = Math.round(hue);
    
    return `brightness(0) saturate(100%) invert(${Math.round(lightness * 100)}%) sepia(70%) saturate(${saturation}%) hue-rotate(${hueRotate}deg) brightness(${brightness}%) contrast(95%)`;
  };

  const generateSignatureHTML = () => {
    const { 
      firstName, lastName, title, department, phone, email, website,
      profileImage, companyLogoUrl, companyTagline, accentColor,
      template, showSocial, showTagline, showMedallions
    } = signatureData;

    const rgbColor = hexToRgb(accentColor);
    const emojiFilter = getEmojiFilter(accentColor);
    const companyLogo = companyLogoUrl || 'https://storage.googleapis.com/tgl_cdn/images/Medallions/TUC.png';

    // Social media icons HTML - using your CDN hosted icons
    const socialIcons = showSocial ? `
<div style="text-align: center; margin: 0; padding: 0; line-height: 0;">
<table cellpadding="0" cellspacing="0" border="0" style="vertical-align: -webkit-baseline-middle; font-size: medium; font-family: Arial; margin: 0 auto; display: inline-table;">
<tbody>
<tr>
<td style="padding-right: 6px;"><a href="https://linkedin.com" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Social/icons8-linkedin-50.png" width="22" height="22" alt="LinkedIn" style="display: block; border: 0; vertical-align: middle;"></a></td>
<td style="padding-right: 6px;"><a href="https://x.com" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Social/icons8-twitter-50.png" width="22" height="22" alt="X/Twitter" style="display: block; border: 0; vertical-align: middle;"></a></td>
<td style="padding-right: 6px;"><a href="https://facebook.com" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Social/icons8-facebook-50.png" width="22" height="22" alt="Facebook" style="display: block; border: 0; vertical-align: middle;"></a></td>
<td style="padding-right: 6px;"><a href="https://instagram.com" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Social/icons8-instagram-50.png" width="22" height="22" alt="Instagram" style="display: block; border: 0; vertical-align: middle;"></a></td>
<td style="padding-right: 6px;"><a href="https://medium.com" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Social/icons8-medium-50.png" width="22" height="22" alt="Medium" style="display: block; border: 0; vertical-align: middle;"></a></td>
<td style="padding-right: 6px;"><a href="https://patreon.com" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Social/YouTube.png" width="22" height="22" alt="YouTube" style="display: block; border: 0; vertical-align: middle;"></a></td>
<td><a href="https://discord.gg/q4tFymyAnx" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Social/Discord-Symbol-Blurple.png" height="22" alt="Discord" style="display: block; border: 0; max-width: 24px; object-fit: contain; vertical-align: middle;"></a></td>
</tr>
</tbody>
</table>
</div>` : '';

    // Medallions HTML with actual subsidiary links
    const medallionsHtml = showMedallions ? `
<table cellpadding="0" cellspacing="0" border="0" style="vertical-align: -webkit-baseline-middle; font-size: medium; font-family: Arial;">
<tbody>
<tr>
<td style="padding-right:4px;padding-bottom:4px"><a href="https://www.arthaneeti.org" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/AR.png" width="32" height="32" alt="Arthaneeti" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-right:4px;padding-bottom:4px"><a href="https://www.theutilitycompany.co" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/CornucopiaRobotics.png" width="32" height="32" alt="Cornucopia Robotics" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-right:4px;padding-bottom:4px"><a href="https://digibazaar.io" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/DigiBazaarMedallion.png" width="32" height="32" alt="DigiBazaar" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-right:4px;padding-bottom:4px"><a href="https://www.theutilitycompany.co" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/IE.png" width="32" height="32" alt="IE" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-right:4px;padding-bottom:4px"><a href="https://www.rensnc.com" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/MKVLI.png" width="32" height="32" alt="MKVLI" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-bottom:4px"><a href="https://www.nftpd.org" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/NFTPD.png" width="32" height="32" alt="NFTPD" style="display:block;border:0;border-radius:16px;"></a></td>
</tr>
<tr>
<td style="padding-right:4px"><a href="https://osiris.theutilitycompany.co" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/OP.png" width="32" height="32" alt="Osiris Protocol" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-right:4px"><a href="https://www.requiem-electric.com" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/RE.png" width="32" height="32" alt="Requiem Electric" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-right:4px"><a href="https://www.thegraineledger.com" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/TGL.png" width="32" height="32" alt="The Graine Ledger" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-right:4px"><a href="https://www.thelochnessbotanicalsociety.com" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/TLN.png" width="32" height="32" alt="Loch Ness Botanical Society" style="display:block;border:0;border-radius:16px;"></a></td>
<td style="padding-right:4px"><a href="https://omgrown.life" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/TSPAum1.png" width="32" height="32" alt="The Satellite Project Om" style="display:block;border:0;border-radius:16px;"></a></td>
<td><a href="https://vulcan-forge.us" target="_blank"><img src="https://storage.googleapis.com/tgl_cdn/images/Medallions/VulcanForge2.png" width="32" height="32" alt="Vulcan Forge" style="display:block;border:0;border-radius:16px;"></a></td>
</tr>
</tbody>
</table>` : '';

    // Return the appropriate template
    if (template === 'professional') {
      return `<table cellpadding="0" cellspacing="0" border="0" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #ffffff 0%, #fafcff 25%, #f0f8ff 50%, #e6f3ff 75%, #ffffff 100%); border-radius: 16px; border: 2px solid rgba(${rgbColor}, 0.2); box-shadow: 0 12px 48px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(${rgbColor}, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.8); position: relative; overflow: hidden;">
<tbody>
<tr>
<td style="padding: 0; position: relative;">
<!-- Decorative accent bar -->
<div style="height: 4px; background: linear-gradient(90deg, rgb(${rgbColor}) 0%, rgba(${rgbColor}, 0.7) 50%, rgb(${rgbColor}) 100%); margin: 0;"></div>
<div style="padding: 24px; position: relative;">
<table cellpadding="0" cellspacing="0" border="0" style="vertical-align: -webkit-baseline-middle; font-size: medium; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
<tbody>
<tr>
<td style="vertical-align: top; padding-right: 18px;">
${profileImage ? `<img src="${profileImage}" width="80" height="80" alt="${firstName} ${lastName}" style="display: block; border-radius: 40px; margin-bottom: 8px; border: 3px solid rgba(${rgbColor}, 0.15); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);">` : ''}
<img src="${companyLogo}" width="80" height="80" alt="Company" style="display: block;">
</td>
<td style="vertical-align: top;">
<h1 style="margin: 0; font-size: 24px; color: rgb(${rgbColor}); font-weight: 700; letter-spacing: -0.5px; text-shadow: 0 2px 4px rgba(${rgbColor}, 0.1);">${firstName} ${lastName}</h1>
<p style="margin: 4px 0; font-size: 16px; color: rgba(${rgbColor}, 0.8); font-weight: 600; letter-spacing: -0.25px;">${title}</p>
<p style="margin: 0 0 8px 0; font-size: 14px; color: #5a6c7d; font-weight: 500;">${department}</p>
${showTagline ? `<p style="margin: 0 0 12px 0; font-size: 13px; color: #6a7c8d; font-style: italic; border-left: 4px solid rgb(${rgbColor}); padding-left: 12px; background: linear-gradient(90deg, rgba(${rgbColor}, 0.05) 0%, transparent 100%); border-radius: 0 4px 4px 0; padding-top: 4px; padding-bottom: 4px;">${companyTagline}</p>` : ''}

<div style="background: linear-gradient(90deg, rgb(${rgbColor}) 0%, rgba(${rgbColor}, 0.5) 70%, transparent 100%); height: 3px; margin: 8px 0; width: 120px; border-radius: 2px; box-shadow: 0 2px 4px rgba(${rgbColor}, 0.2);"></div>

<div style="margin: 8px 0; padding: 8px; background: linear-gradient(145deg, rgba(${rgbColor}, 0.03) 0%, rgba(${rgbColor}, 0.08) 100%); border-radius: 8px; border: 1px solid rgba(${rgbColor}, 0.1);">
<p style="margin: 2px 0; font-size: 13px; font-weight: 500;">
<img src="https://storage.googleapis.com/tgl_cdn/images/symbols/mobile.png" width="16" height="16" alt="Phone" style="display: inline-block; vertical-align: middle; margin-right: 6px; filter: ${emojiFilter};"> <a href="tel:+1${phone.replace(/\D/g, '')}" style="color: #2d3748; text-decoration: none; font-weight: 500;">${phone}</a>
</p>
<p style="margin: 2px 0; font-size: 13px; font-weight: 500;">
<img src="https://storage.googleapis.com/tgl_cdn/images/symbols/mail.png" width="16" height="16" alt="Email" style="display: inline-block; vertical-align: middle; margin-right: 6px; filter: ${emojiFilter};"> <a href="mailto:${email}" style="color: rgb(${rgbColor}); text-decoration: none; font-weight: 600;">${email}</a>
</p>
<p style="margin: 2px 0; font-size: 13px; font-weight: 500;">
<img src="https://storage.googleapis.com/tgl_cdn/images/symbols/web.png" width="16" height="16" alt="Website" style="display: inline-block; vertical-align: middle; margin-right: 6px; filter: ${emojiFilter};"> <a href="https://${website}" style="color: rgb(${rgbColor}); text-decoration: none; font-weight: 600;">${website}</a>
</p>
</div>
  
  ${socialIcons ? `<div style="margin: 10px 0; padding: 6px; background: linear-gradient(135deg, rgba(${rgbColor}, 0.05) 0%, rgba(${rgbColor}, 0.1) 100%); border-radius: 10px; border: 1px solid rgba(${rgbColor}, 0.15);">${socialIcons}</div>` : ''}
  ${medallionsHtml ? `<div style="margin: 10px 0; padding: 8px; background: linear-gradient(135deg, rgba(${rgbColor}, 0.05) 0%, rgba(${rgbColor}, 0.12) 100%); border-radius: 12px; border: 2px solid rgba(${rgbColor}, 0.2); box-shadow: inset 0 2px 4px rgba(${rgbColor}, 0.1);">${medallionsHtml}</div>` : ''}
  
  </td>
</tr>
</tbody>
</table>
</div>
</td>
</tr>
</tbody>
</table>`;
    }

    // For now, return professional template for all others
    return `<table cellpadding="0" cellspacing="0" border="0" style="vertical-align: -webkit-baseline-middle; font-size: medium; font-family: Arial;">
<tbody>
<tr>
<td style="padding: 10px;">
<h2 style="margin: 0; color: ${accentColor};">${firstName} ${lastName}</h2>
<p style="margin: 3px 0;">${title}</p>
  <p style="margin: 0;">📱 ${phone} | ✉️ ${email} | 🌐 ${website}</p>
  ${socialIcons ? `<div style="margin: 6px 0;">${socialIcons}</div>` : ''}
  ${medallionsHtml ? `<div style="margin: 6px 0; padding: 2px 4px; background: rgba(${rgbColor}, 0.05); border-radius: 6px; border: 1px solid rgba(${rgbColor}, 0.1);">${medallionsHtml}</div>` : ''}
  </td>
</tr>
</tbody>
</table>`;
  };

  const copyToClipboard = async () => {
    const signatureHTML = generateSignatureHTML();
    
    // Format like HubSpot with fragment markers and proper HTML wrapping
    const formattedHTML = `<html>
<body>
<!--StartFragment--><html><head></head><body>${signatureHTML}</body></html><!--EndFragment-->
</body>
</html>`;

    try {
      // Use modern Clipboard API with multiple formats
      if (navigator.clipboard && window.ClipboardItem) {
        const clipboardItem = new ClipboardItem({
          'text/html': new Blob([formattedHTML], { type: 'text/html' }),
          'text/plain': new Blob([`${signatureData.firstName} ${signatureData.lastName}\n${signatureData.title}\n${signatureData.department}\n\n📱 ${signatureData.phone}\n✉️ ${signatureData.email}\n🌐 ${signatureData.website}`], { type: 'text/plain' })
        });
        
        await navigator.clipboard.write([clipboardItem]);
        setCopiedToClipboard(true);
        setTimeout(() => setCopiedToClipboard(false), 3000);
      } else {
        // Fallback for older browsers
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = formattedHTML;
        document.body.appendChild(tempDiv);
        
        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        document.execCommand('copy');
        setCopiedToClipboard(true);
        setTimeout(() => setCopiedToClipboard(false), 3000);
        
        selection?.removeAllRanges();
        document.body.removeChild(tempDiv);
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Additional fallback - copy just the HTML to clipboard as text
      try {
        await navigator.clipboard.writeText(formattedHTML);
        setCopiedToClipboard(true);
        setTimeout(() => setCopiedToClipboard(false), 3000);
      } catch (textErr) {
        console.error('Text fallback also failed:', textErr);
      }
    }
  };



  const saveSignature = async () => {
    try {
      setSaving(true);
      setSavedStatus('idle');
      // Build signature HTML and meta payload
      const signatureHTML = generateSignatureHTML();
      const meta = {
        accentColor: signatureData.accentColor,
        template: signatureData.template,
        showSocial: signatureData.showSocial,
        showTagline: signatureData.showTagline,
        showMedallions: signatureData.showMedallions,
        companyLogoUrl: signatureData.companyLogoUrl,
        profileImage: signatureData.profileImage,
        firstName: signatureData.firstName,
        lastName: signatureData.lastName,
        title: signatureData.title,
        department: signatureData.department,
        phone: signatureData.phone,
        email: signatureData.email,
        website: signatureData.website,
      };

      const res = await fetch('/api/profile/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureHtml: signatureHTML, meta }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed to save signature');
      }
      setSavedStatus('ok');
    } catch (e) {
      console.error('Save signature failed', e);
      setSavedStatus('error');
      alert(typeof e === 'string' ? e : (e as any)?.message || 'Failed to save signature');
    } finally {
      setSaving(false);
      // auto-clear status after a short delay
      setTimeout(() => setSavedStatus('idle'), 3000);
    }
  };

  if (!hasAccess) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-300">You need to have a role in the company directory to access this feature.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="p-4 sm:p-6 lg:p-8">


      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl sm:text-2xl font-bold">📧 Gmail Signature Builder</h3>
      </div>
      
      {/* Social Media Links */}
      <div className="flex justify-around mb-4 py-2 bg-gray-800/20 rounded-lg">
        <a href="https://facebook.com" target="_blank" className="text-gray-400 hover:text-blue-500 transition-colors">
          <FaFacebook size={20} />
        </a>
        <a href="https://x.com" target="_blank" className="text-gray-400 hover:text-gray-300 transition-colors">
          <FaXTwitter size={20} />
        </a>
        <a href="https://linkedin.com" target="_blank" className="text-gray-400 hover:text-blue-600 transition-colors">
          <FaLinkedin size={20} />
        </a>
        <a href="https://instagram.com" target="_blank" className="text-gray-400 hover:text-pink-500 transition-colors">
          <FaInstagram size={20} />
        </a>
        <a href="https://medium.com" target="_blank" className="text-gray-400 hover:text-green-600 transition-colors">
          <FaMedium size={20} />
        </a>
        <a href="https://patreon.com" target="_blank" className="text-gray-400 hover:text-orange-600 transition-colors">
          <FaPatreon size={20} />
        </a>
        <a href="https://discord.gg/q4tFymyAnx" target="_blank" className="text-gray-400 hover:text-blue-500 transition-colors">
          <FaDiscord size={20} />
        </a>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-full">
        {/* Input Form */}
        <div className="lg:col-span-2 space-y-3">
          {/* Basic Info */}
          <div className="bg-gray-800/40 rounded-md p-3 border border-gray-700">
            <h4 className="text-sm font-medium text-gray-200 mb-2 flex items-center">
              <span className="w-1.5 h-1.5 bg-[#F54029] rounded-full mr-1.5"></span>
              Personal Info
            </h4>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-0.5">First Name</label>
                  <input
                    type="text"
                    value={signatureData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-gray-800/60 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-[#F54029]"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-0.5">Last Name</label>
                  <input
                    type="text"
                    value={signatureData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-gray-800/60 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-[#F54029]"
                    placeholder="Doe"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-0.5">Job Title</label>
                <input
                  type="text"
                  value={signatureData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-gray-800/60 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-[#F54029]"
                  placeholder="Chief Technology Officer"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-0.5">Department</label>
                <input
                  type="text"
                  value={signatureData.department}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-gray-800/60 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-[#F54029]"
                  placeholder="Technology & Innovation"
                />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-gray-800/40 rounded-md p-3 border border-gray-700">
            <h4 className="text-sm font-medium text-gray-200 mb-2 flex items-center">
              <span className="w-1.5 h-1.5 bg-[#F54029] rounded-full mr-1.5"></span>
              Contact Info
            </h4>
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-0.5">Phone</label>
                <input
                  type="tel"
                  value={signatureData.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-gray-800/60 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-[#F54029]"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-0.5">Email</label>
                <input
                  type="email"
                  value={signatureData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-gray-800/60 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-[#F54029]"
                  placeholder="john.doe@theutilitycompany.co"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-0.5">Website</label>
                <input
                  type="text"
                  value={signatureData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-gray-800/60 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-[#F54029]"
                  placeholder="theutilitycompany.co"
                />
              </div>
            </div>
          </div>



          {/* Customization */}
          <div className="bg-gray-800/40 rounded-md p-3 border border-gray-700">
            <h4 className="text-sm font-medium text-gray-200 mb-2 flex items-center">
              <span className="w-1.5 h-1.5 bg-[#F54029] rounded-full mr-1.5"></span>
              Customization
            </h4>
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-0.5">Accent Color</label>
                <div className="flex gap-1.5">
                  <input
                    type="color"
                    value={signatureData.accentColor}
                    onChange={(e) => handleInputChange('accentColor', e.target.value)}
                    className="w-12 h-8 rounded border border-gray-600 bg-gray-800"
                  />
                  <input
                    type="text"
                    value={signatureData.accentColor}
                    onChange={(e) => handleInputChange('accentColor', e.target.value)}
                    className="flex-1 px-2 py-1.5 text-sm bg-gray-800/60 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-[#F54029]"
                    placeholder="#F54029"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-0.5">Tagline</label>
                <input
                  type="text"
                  value={signatureData.companyTagline}
                  onChange={(e) => handleInputChange('companyTagline', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-gray-800/60 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-[#F54029]"
                  placeholder="Empowering Innovation"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={signatureData.showSocial}
                    onChange={(e) => handleInputChange('showSocial', e.target.checked)}
                    className="rounded border-gray-600 bg-gray-800 text-[#F54029] focus:ring-[#F54029] w-3 h-3"
                  />
                  <span className="text-xs text-gray-300">Social Links</span>
                </label>
                
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={signatureData.showMedallions}
                    onChange={(e) => handleInputChange('showMedallions', e.target.checked)}
                    className="rounded border-gray-600 bg-gray-800 text-[#F54029] focus:ring-[#F54029] w-3 h-3"
                  />
                  <span className="text-xs text-gray-300">Medallions</span>
                </label>
                
                                  <div>
                  <label className="block text-xs font-medium text-gray-300 mb-0.5">Profile Picture</label>
                  
                  {/* File Upload */}
                  <div className="mb-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(file);
                        }
                      }}
                      disabled={uploading}
                      className="w-full px-2 py-1.5 text-sm bg-gray-800/60 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-[#F54029] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-[#F54029] file:text-white disabled:opacity-50"
                    />
                    {uploading && (
                      <p className="text-xs text-blue-400 mt-1">📤 Uploading to CDN...</p>
                    )}
                  </div>

                  {/* URL Input */}
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-0.5">Or paste image URL:</label>
                    <input
                      type="url"
                      value={signatureData.profileImage}
                      onChange={(e) => handleInputChange('profileImage', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm bg-gray-800/60 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-[#F54029]"
                      placeholder="https://your-image-url.com/profile.jpg"
                    />
                  </div>
                  
                  <p className="text-xs text-gray-400 mt-1">💡 Upload automatically saves to CDN for Gmail compatibility</p>
                </div>
                
                {/* Company Logo */}
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-0.5">Company Logo</label>
                  <div className="mb-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleCompanyLogoUpload(file);
                        }
                      }}
                      disabled={uploading}
                      className="w-full px-2 py-1.5 text-sm bg-gray-800/60 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-[#F54029] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-[#F54029] file:text-white disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-0.5">Or paste logo URL:</label>
                    <input
                      type="url"
                      value={signatureData.companyLogoUrl}
                      onChange={(e) => handleInputChange('companyLogoUrl', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm bg-gray-800/60 border border-gray-600 rounded text-gray-100 focus:outline-none focus:border-[#F54029]"
                      placeholder="https://your-logo-url.com/logo.png"
                    />
                  </div>
                </div>
                
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={signatureData.showTagline}
                    onChange={(e) => handleInputChange('showTagline', e.target.checked)}
                    className="rounded border-gray-600 bg-gray-800 text-[#F54029] focus:ring-[#F54029] w-3 h-3"
                  />
                  <span className="text-xs text-gray-300">Show Tagline</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={saveSignature}
              disabled={saving}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded hover:from-emerald-600/80 hover:to-teal-600/80 transition-all duration-300 font-semibold text-sm shadow-md hover:shadow-lg disabled:opacity-60"
            >
              {saving ? '💾 Saving…' : (savedStatus === 'ok' ? '✅ Saved' : '💾 Save Signature')}
            </button>
            <button
              onClick={copyToClipboard}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-[#F54029] to-[#ff6b47] text-white rounded hover:from-[#F54029]/80 hover:to-[#ff6b47]/80 transition-all duration-300 font-semibold text-sm shadow-md hover:shadow-lg"
            >
              {copiedToClipboard ? '✅ Copied!' : '📋 Copy Signature'}
            </button>
          </div>
        </div>
        
        {/* Preview */}
        <div className="bg-white/10 backdrop-blur-sm rounded-md p-3 border border-gray-600">
          <h4 className="text-sm font-medium mb-2 text-gray-200 flex items-center">
            <span className="w-1.5 h-1.5 bg-[#F54029] rounded-full mr-1.5"></span>
            Preview
          </h4>
          <div className="bg-white rounded p-4 overflow-auto" style={{ minHeight: '200px', fontSize: '14px' }}>
            <div dangerouslySetInnerHTML={{ __html: generateSignatureHTML() }} />
          </div>
        </div>
      </div>
      
      {/* Instructions */}
      <div className="mt-3 p-3 bg-gray-800/30 rounded border border-gray-700">
        <h4 className="text-xs font-medium text-gray-300 mb-1.5">📝 Quick Setup:</h4>
        <ol className="text-xs text-gray-400 space-y-0.5 list-decimal list-inside">
          <li>Fill form above</li>
          <li>Copy signature</li>
          <li>Gmail Settings → General → Signature</li>
          <li>Paste & save</li>
        </ol>
      </div>
    </div>
    </div>
    );
};

export default SignatureBuilder;
